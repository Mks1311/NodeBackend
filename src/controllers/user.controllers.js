import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"

export const registerUser=asyncHandler(async(req,res)=>{

    // take user data
    const {username,email,fullName,password}=req.body;
    console.log('object',email)


     //data vaildation
    if(
        [fullName,email,username,password].some((field)=>(field?.trim()===""))
    ){
        throw new ApiError(400, "All fields are required")
    }

    //check if it already exists: username,email
    const existedUser=User.findOne({
        $or:[{ username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    //check for images, avatar
    const avatarLocalPath=req.files?.avatar[0]?.path;
    const coverImageLocalPath=req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }


    //upload them to cloudinary and check
    const avatarCloudUrl=await uploadOnCloudinary(avatarLocalPath)

    const coverImageCloudUrl=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatarCloudUrl){
        throw new ApiError(400, "Avatar file is required")
    }

    //create user object - create entry in db
    const user=User.create({
        fullName,
        avatar:avatarCloudUrl.url,
        coverImage:coverImageCloudUrl?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })


    //remove password and refresh token field from resposne
    //check for user creation
    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong when registering the user")
    }


    //return res
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )
})