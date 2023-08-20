import { ErrorHandler } from "../utils/errorHandler.js";
import { catchAsyncError } from "./catchAsyncError.js";
import Jwt  from "jsonwebtoken";
import User from "../models/user-model.js";

export const isAuthenticatedUser = catchAsyncError(async(req,res,next)=>{
    const {token} = req.cookies
    if(!token){
        return next(new ErrorHandler("Please Login first to access this route",401))
    }
    const decodedData = Jwt.verify(token,process.env.JWT_SECRET_KEY)
    req.user = await User.findById(decodedData.id)
    next()
})

export const userRole= (...roles) =>{
    return (req,res,next)=>{
        if(!roles.includes(req.user.role)){
        return next(new ErrorHandler(`Role: ${req.user.role} are now allowed for this route`,403))
        }
        next()
    }
}