// require('dotenv').config({path:'./env'})
import dotenv from "dotenv"
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path:'./env'
});


connectDB()
.then(()=>{
    app.on('error',(error)=>{
        console.log('express error',error)
        throw error;
    })
    
    app.listen(process.env.PORT || 8000,()=>{
        console.log('Server is running at port')
    })
})
.catch((err)=>{
    console.log('Mongo db conncetion failed!!',err)
})
