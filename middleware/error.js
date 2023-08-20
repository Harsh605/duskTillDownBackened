import { ErrorHandler } from "../utils/errorHandler.js";

export const Error = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Internal Server Error";


    if(err.name=="CastError"){
        const message = `Resource not found. Invalid ${err.path}`
        err = new ErrorHandler(message,400)
    }

    // monggose duplicate key error like email unique
    if(err.code===11000){
        const message = `Duplicate ${Object.keys(err.keyValue)} Entered.`
        err = new ErrorHandler(message,400)
    }
    // Wrong Jwt Token error
    if(err.code==="JsonWebTokenError"){
        const message = `Json Web Token is invalid, Try again`
        err = new ErrorHandler(message,400)
    }
    //  Jwt expire error
    if(err.code==="JsonWebTokenError"){
        const message = `Json Web Token is Expired, Try again`
        err = new ErrorHandler(message,400)
    }
    //common error
    res.status(err.statusCode).json({
        success: false,
        error: err.message
        // error: err.stack
        
    })

}
