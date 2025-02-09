import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens=async(user)=>{
    try {
    //    const user=await User.findById(userId)
       const accessToken=user.generateAccessToken()
       const refreshToken=user.generateRefreshToken()

       user.refreshToken=(refreshToken)
       await user.save({validateBeforeSave:false})

       return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const cookieoptions={
    httpOnly:true,
    secure:true
}

export const registerUser=asyncHandler(async(req,res)=>{

    // take user data
    const {username,email,fullName,password}=req.body;

     //data vaildation
    if(
        [fullName,email,username,password].some((field)=>(field?.trim()===""))
    ){
        throw new ApiError(400, "All fields are required")
    }

    //check if it already exists: username,email
    const existedUser=await User.findOne({
        $or:[{ username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    //check for images, avatar
    const avatarLocalPath=req.files?.avatar[0]?.path;
    const coverImageLocalPath=req.files?.coverImage && req.files?.coverImage[0]?.path;

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
    const user=await User.create({
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

export const loginUser=asyncHandler(async(req,res)=>{
    //take data from req body
    const {email,username,password}=req.body

    if(!username && !email ){
        throw new ApiError(400,"username or email is required")
    }

    if(!password){
        throw new ApiError(400,"password is required")
    }

    const user =await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(400,"User does not exists")
    }

    const isPasswordValid=await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user)

    // const loggedInUser=User.findById(user._id).select("-password -refreshToken")

    return res.status(200).cookie("accessToken",accessToken,cookieoptions).cookie("refreshToken",refreshToken,cookieoptions).json(
        new ApiResponse(
            200,
            {
                accessToken:accessToken,
                refreshToken:refreshToken,
            },
            "User Logged In Successfully"
        )
    )
})

export const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    return res.status(200).clearCookie("accessToken",cookieoptions).clearCookie("refreshToken",cookieoptions).json(new ApiResponse(200,{},"User logged out"))
})

export const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request")
    }

    const decodedToken=jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )

    const user=await User.findById(decodedToken?._id)

    if(!user){
        throw new ApiError(401,"Invalid refresh token")
    }

    if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401,"Refresh token is expired or used")
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user)

    return res.status(200).cookie("accessToken",accessToken,cookieoptions).cookie("refreshToken",refreshToken,cookieoptions).json(
        new ApiResponse(
            200,
            {accessToken,refreshToken}
        )
    )
    
})