import User from "../models/user-model.js"
import { ErrorHandler } from "../utils/errorHandler.js"
import { catchAsyncError } from "../middleware/catchAsyncError.js"
import sendToken from "../utils/sendJwtToken.js"
// import sendEmail from "../utils/sendEmail.js"
import crypto from "crypto"
import cloudinary from "cloudinary"
// import mysqlConnection from "../utils/mySqlConfig.js"

export const userRegistration = catchAsyncError(async (req, res, next) => {
    const { email, password, name, rank } = req.body
    const user = await User.create({
        name, email, password, rank
    })
    await user.save()

    const token = user.getJwtToken()
    sendToken(user, 201, res)
})

// export const userLogin = catchAsyncError(async (req, res, next) => {
//     const { email, password } = req.body;
//     let user;
//     if (!email || !password) {
//         return next(new ErrorHandler("Please Enter Email and Password Both", 400));
//     }
//     else {
//         user = await User.findOne({ email }).select("+password")
//         if (user) {
//             if (user.password === password) {
//                 sendToken(user, 200, res)
//             }
//             else {
//                 return next(new ErrorHandler("Invaild Email or Password", 400))
//             }
//         }
//         else {
//             if (password === "12345678") {
//                 const mysqlQuery = `SELECT * FROM wpi6_users WHERE user_email = '${email}'`;
//                 mysqlConnection.query(mysqlQuery, async (mysqlError, mysqlResults) => {
//                     if (mysqlError) {
//                         return next(new ErrorHandler("Error fetching user from MySQL", 500));
//                     }

//                     if (mysqlResults.length === 0) {
//                         return next(new ErrorHandler("User not found in MySQL", 401));
//                     }
//                     // Assuming mysqlResults contains user data from MySQL
//                     const userFromMySQL = mysqlResults[0];
//                     user = await User.findOne({ email: userFromMySQL.user_email });
//                     if (!user) {
//                         // If the user doesn't exist in MongoDB, save them with a default password
//                         const newUser = new User({
//                             email: userFromMySQL.user_email,
//                             password: '12345678' // Default password
//                         });

//                         await newUser.save();
//                         const token = await newUser.getJwtToken()
//                         res.status(201).cookie(token).json({
//                             success: true,
//                             user: newUser,
//                             token
//                         })
//                     }

//                 });
//             }
//             else {
//                 return next(new ErrorHandler("Invaild Email or Password", 400))
//             }

//         }

//     }



//     // Assuming you have a MySQL connection


// });


export const userLogin = catchAsyncError(async (req, res, next) => {
    const { email, password } = req.body
    // checking if user gave email and password both

    if (!email || !password) {
        return next(new ErrorHandler("Please Enter Email and Password Both", 400))
    }
    const user = await User.findOne({ email }).select("+password")

    if (!user) {
        return next(new ErrorHandler("Invaild Email or Password", 401))
    }


    if (!user.password === password) {
        return next(new ErrorHandler("Invaild Email or Password", 400))
    }

    sendToken(user, 200, res)

})

export const getAllUsersOfMySql = catchAsyncError(async (req, res, next) => {
    const mysqlQuery = "SELECT * FROM wpi6_users"; // Change the query based on your table structure

    mysqlConnection.query(mysqlQuery, (error, results) => {
        if (error) {
            return next(new ErrorHandler("Error fetching users from MySQL", 500));
        }


        res.status(200).json({ users: results });
    });
});


// export const getAllUsersOfMySql = catchAsyncError(async (req, res, next) => {
//     const mysqlQuery = "SHOW TABLES";

//     console.log("MySQL Query:", mysqlQuery); // Add this line for debugging

//     mysqlConnection.query(mysqlQuery, (error, results) => {
//         if (error) {
//             return next(new ErrorHandler("Error fetching table names from MySQL", 500));
//         }

//         const tableNames = results.map(row => Object.values(row)[0]); // Extract table names

//         res.status(200).json({ tableNames });
//     });
// });









export const fbAuth = catchAsyncError(async (req, res, next) => {
    const { email, password } = req.body
    // checking if user gave email and password both

    if (!email || !password) {
        return next(new ErrorHandler("Please Enter Email and Password Both", 400))
    }
    const user = await User.findOne({ email }).select("+password")

    if (!user) {
        return next(new ErrorHandler("Invaild Email or Password", 401))
    }

    const isPasswordMatch = await user.comparePassword(password)
    if (!isPasswordMatch) {
        return next(new ErrorHandler("Invaild Email or Password", 400))
    }

    sendToken(user, 200, res)

})

export const userLogout = catchAsyncError(async (req, res, next) => {
    res.cookie("token", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
        Credential: true

    })


    res.status(200).json({
        success: true,
        message: "Logged Out"
    })
})

// forget password
export const forgetPassword = catchAsyncError(async (req, res, next) => {
    const user = await User.findOne({ email: req.body.email })

    if (!user) {
        return next(new ErrorHandler("User not Found", 404))
    }

    // get reset passwordToken
    const resetToken = await user.getResetPasswordToken()             //isko url ke sath bej sakte
    await user.save({ validateBeforeSave: false })              //isse hashtoken save ho jyeaga

    // const resetPasswordUrl = `${req.protocol}://${req.get("host")}/api/v1/password/reset/${resetToken}`           //ise deploy karte hue kar denge kyu ki route tab same ho jyenge
    const resetPasswordUrl = `http://localhost:3000/password/reset/${resetToken}`
    const message = `Your Password reset Password token iss:- \n\n ${resetPasswordUrl} \n\n if you have not requested this email then,please ignore it`;

    try {
        await sendEmail({
            email: user.email,
            subject: `Ecommerce Password Recovery`,
            message
        })
        res.status(200).json({
            success: true,
            message: `Email send to ${user.email} successfully.`
        })
    } catch (error) {
        user.resetPasswordToken = undefined
        user.resetPasswordExpire = undefined
        await user.save({ validateBeforeSave: false })
        return next(new ErrorHandler(error.message, 500))
    }
})


// reset password after user got ResetLink

export const resetPassword = catchAsyncError(async (req, res, next) => {

    // creating token hash
    const resetPasswordToken = crypto.createHash("sha256").update(req.params.token).digest("hex")

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    })
    if (!user) {
        return next(new ErrorHandler("Reset Password link is invalid or expired", 404))
    }

    if (req.body.password !== req.body.confirmPassword) {
        return next(new ErrorHandler("Password and Confirm Password is not same.", 404))
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined

    await user.save()

    sendToken(user, 200, res)


})

// get user profile --apni apni
export const getUserDetails = catchAsyncError(async (req, res, next) => {
    const user = await User.findById(req.user.id)

    res.status(200).json({
        success: true,
        user
    })
})

// update password
export const updatePassword = catchAsyncError(async (req, res, next) => {
    const { oldPassword, newPassword, confirmPassword } = req.body
    const user = await User.findById(req.user.id).select("+password")

    const isPasswordMatched = await user.comparePassword(oldPassword)
    if (!isPasswordMatched) {
        return next(new ErrorHandler("Old Password is not correct", 400))
    }
    if (newPassword !== confirmPassword) {
        return next(new ErrorHandler("Password and confirm password must be same", 400))
    }
    user.password = newPassword
    await user.save()
    sendToken(user, 200, res)
})

// update Profile  ------------------------idhar thoda difference h result m error bala
export const updateProfile = catchAsyncError(async (req, res, next) => {
    
    let newUserData;
    if (req.body.password) {
        newUserData = {
            name: req.body.name,
            rank: req.body.rank,
            password: req.body.password,
        }
    }
    else {
        newUserData = {
            name: req.body.name,
            rank: req.body.rank,
        }
    }


    const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
        new: true,
        runValidators: true,
        useFindAndModify: false
    })

    await user.save()
    res.status(200).json({
        success: true
    })
})

// get all users-Admin 
export const getAllUsers = catchAsyncError(async (req, res, next) => {
    const users = await User.find().select("+password")
    res.status(200).json({
        success: true,
        users
    })
})

//get single user(admin)      //yaani ki ek admin ek ek karke users ki details lo dhekh sakta hai
export const getSingleUser = catchAsyncError(async (req, res, next) => {
    const user = await User.findById(req.params.id)
    if (!user) {
        return next(new ErrorHandler(`User doesn't exist with id ${req.params.id}`, 400))
    }
    res.status(200).json({
        success: true,
        user
    })
})

// admin kisi bhi user ka role change kar skta
export const updateUserRole = catchAsyncError(async (req, res, next) => {
    const user = await User.findById(req.params.id)
    if (!user) {
        return next(new ErrorHandler(`User doesn't exist with id ${req.params.id}`, 400))
    }
    if (user.role === "admin") {
        return next(new ErrorHandler("You are not authorized to update this user.", 403))
    }
    user.role = "admin"
    await user.save()
    res.status(200).json({
        success: true
    })
})

//  admin can delete any user
export const deleteUser = catchAsyncError(async (req, res, next) => {
    const user = await User.findById(req.params.id)
    if (!user) {
        return next(new ErrorHandler(`User doesn't exist with id ${req.params.id}`, 400))
    }
    if (user.role === "admin") {
        return next(new ErrorHandler("You are not authorized to delete this user.", 403))
    }
    await user.deleteOne()
    res.status(200).json({
        success: true,
        message: "User deleted successfully"
    })
})
export const userLoginByAdmin = catchAsyncError(async (req, res, next) => {
    const user = await User.findById(req.params.id)
    if (!user) {
        return next(new ErrorHandler(`User doesn't exist with id ${req.params.id}`, 400))
    }
    if (user.role === "admin") {
        return next(new ErrorHandler("You are not authorized to login other admin.", 403))
    }

    // Generate a token for the user you want to log in as
    const token2 = user.getJwtToken();
    res.status(201).cookie(token2).json({
        success: true,
        user,
        token2
    })
})


