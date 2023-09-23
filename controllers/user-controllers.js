import User from "../models/user-model.js"
import { ErrorHandler } from "../utils/errorHandler.js"
import { catchAsyncError } from "../middleware/catchAsyncError.js"
import sendToken from "../utils/sendJwtToken.js"
import crypto from "crypto"

import stripe from 'stripe';
const stripeInstance = new stripe("sk_test_51NWOvfKxOSFxtjuosKMsKo6KOraoVqoz8s5Ky4sKA6e4NahYzXiCHtk7CuyrhLvnNILd792BoN9SzUwzh5KE4YO800NyRuVRhE");




// export const userLogin = catchAsyncError(async (req, res, next) => {
//     const { email, password } = req.body

//     if (!email || !password) {
//         return next(new ErrorHandler("Please Enter Email and Password Both", 400))
//     }

//     const user = await User.findOne({ email }).select("+password")

//     if (!user) {
//         // Check if the email exists in Stripe transactions
//         try {
//             const stripeCustomers = await stripeInstance.customers.list({ email: email });
//             if (stripeCustomers && stripeCustomers.data.length > 0) {

//                 const stripeCustomer = stripeCustomers.data[0];
//                 const customerPayments = await stripeInstance.paymentIntents.list({
//                     customer: stripeCustomer.id,
//                 });
//                 console.log(customerPayments)
//                 const newUser = new User({ email, password: "1234" });
//                 await newUser.save();
//                 console.log("hey")
//                 sendToken(newUser, 200, res);
//             } else {
//                 return next(new ErrorHandler("Invalid Email or Password", 401));
//             }
//         } catch (error) {
//             // Handle any Stripe API errors here
//             return next(new ErrorHandler("Error communicating with Stripe", 500));
//         }
//     } else {
//         if (user.password !== password) {
//             return next(new ErrorHandler("Invalid Email or Password", 400))
//         }

//         sendToken(user, 200, res);
//     }
// })




// export const userLogin = catchAsyncError(async (req, res, next) => {
//     const { email, password } = req.body

//     if (!email || !password) {
//         return next(new ErrorHandler("Please Enter Email and Password Both", 400))
//     }

//     // First, check if the user exists in your MongoDB database
//     const user = await User.findOne({ email }).select("+password")

//     if (user) {
//         // If the user is found in MongoDB, check their password
//         if (user.password === password) {
//             const currentDate = new Date();
//             const transactionDate = user.transactionDate;
//             // Calculate the difference in days
//             const daysDifference = Math.floor(
//                 (currentDate - transactionDate) / (1000 * 60 * 60 * 24)
//             );

//             if (daysDifference <= 30) {
//                 // If the transaction is within 30 days, log in
//                 sendToken(user, 200, res);
//             } else {
//                 // If the transaction is older than 30 days, check Stripe transactions
//                 try {
//                     const stripeCustomers = await stripeInstance.customers.list({ email: email });
//                     if (stripeCustomers && stripeCustomers.data.length > 0) {
//                         const stripeCustomer = stripeCustomers.data[0];

//                         // Check the latest transaction date in Stripe
//                         const customerPayments = await stripeInstance.paymentIntents.list({
//                             customer: stripeCustomer.id,
//                         });

//                         if (customerPayments && customerPayments.data.length > 0) {
//                             const latestPayment = customerPayments.data[0];
//                             const stripeTransactionDate = new Date(latestPayment.created * 1000);

//                             // Calculate the difference in days
//                             const stripeDaysDifference = Math.floor(
//                                 (currentDate - stripeTransactionDate) / (1000 * 60 * 60 * 24)
//                             );

//                             if (stripeDaysDifference <= 30) {
//                                 // Update the user's transactionDate in MongoDB
//                                 user.transactionDate = stripeTransactionDate;
//                                 await user.save();

//                                 // Log in the user
//                                 sendToken(user, 200, res);
//                             } else {
//                                 // If the latest Stripe transaction is also older than 30 days, prompt the user to update their password
//                                 return next(new ErrorHandler("Password update required", 401));
//                             }
//                         } else {
//                             return next(new ErrorHandler("No payment history found in Stripe", 401));
//                         }
//                     } else {
//                         return next(new ErrorHandler("Invalid Email or Password", 401));
//                     }
//                 } catch (error) {
//                     // Handle any Stripe API errors here
//                     return next(new ErrorHandler("Error communicating with Stripe", 500));
//                 }
//             }
//         } else {
//             return next(new ErrorHandler("Invalid Email or Password", 400))
//         }
//     } else {
//         // If the user is not found in MongoDB, check in Stripe transactions as before
//         try {
//             const stripeCustomers = await stripeInstance.customers.list({ email: email });
//             if (stripeCustomers && stripeCustomers.data.length > 0) {
//                 const stripeCustomer = stripeCustomers.data[0];

//                 // Check the latest transaction date in Stripe
//                 const customerPayments = await stripeInstance.paymentIntents.list({
//                     customer: stripeCustomer.id,
//                 });

//                 if (customerPayments && customerPayments.data.length > 0) {
//                     const latestPayment = customerPayments.data[0];
//                     const currentDate = new Date();
//                     const stripeTransactionDate = new Date(latestPayment.created * 1000);
//                     // Calculate the difference in days
//                     const stripeDaysDifference = Math.floor(
//                         (currentDate - stripeTransactionDate) / (1000 * 60 * 60 * 24)
//                     );

//                     if (stripeDaysDifference <= 30) {
//                         // Log in with Stripe data and update transactionDate in MongoDB
//                         const newUser = new User({
//                             email,
//                             password: "1234", // Reset password to "1234"
//                             transactionDate: stripeTransactionDate, // Update transaction date
//                         });
//                         await newUser.save();
//                         sendToken(newUser, 200, res);
//                     } else {
//                         // If the latest Stripe transaction is older than 30 days, prompt the user to update their password
//                         return next(new ErrorHandler("Password update required", 401));
//                     }
//                 } else {
//                     return next(new ErrorHandler("No payment history found in Stripe", 401));
//                 }
//             } else {
//                 return next(new ErrorHandler("Invalid Email or Password", 401));
//             }
//         } catch (error) {
//             // Handle any Stripe API errors here
//             return next(new ErrorHandler("Error communicating with Stripe", 500));
//         }
//     }
// });


export const userLogin = catchAsyncError(async (req, res, next) => {

    const { email, password } = req.body;



    if (!email || !password) {
        return next(new ErrorHandler("Please Enter Email and Password Both", 400));
    }


    if (email === "cs@theanalyticaladvantage.com") {
        const user = await User.findOne({ email }).select("+password");

        if (user) {
            if (user.password === password) {
                sendToken(user, 200, res);
            } else {
                return next(new ErrorHandler("Invalid Email or Password", 401));
            }
        } else {
            if (password === "12345678") {
                const newUser = new User({
                    email,
                    password: "12345678",
                    role: "admin"
                });
                await newUser.save();
                sendToken(newUser, 200, res);
            } else {
                return next(new ErrorHandler("Invalid Email or Password", 401));
            }
        }
    }

    // First, check if the user exists in your MongoDB database
    const user = await User.findOne({ email }).select("+password");

    if (user) {
        if (user.password === password) {
            const currentDate = new Date();
            const transactionDate = user.transactionDate;
            const daysDifference = Math.floor(
                (currentDate - transactionDate) / (1000 * 60 * 60 * 24)
            );

            if (daysDifference <= 30) {
                // If the transaction is within 30 days, log in
                sendToken(user, 200, res);
            } else {
                // If the transaction is older than 30 days, check Stripe transactions
                try {
                    const stripeCustomers = await stripeInstance.customers.list({ email: email });
                    if (stripeCustomers && stripeCustomers.data.length > 0) {
                        const stripeCustomer = stripeCustomers.data[0];

                        // Check the latest transaction in Stripe
                        const customerPayments = await stripeInstance.paymentIntents.list({
                            customer: stripeCustomer.id,
                            limit: 1, // Limit to the latest payment
                        });

                        if (
                            customerPayments &&
                            customerPayments.data.length > 0 &&
                            customerPayments.data[0].status === "succeeded"
                        ) {
                            const latestPayment = customerPayments.data[0];
                            const stripeTransactionDate = new Date(latestPayment.created * 1000);
                            const stripeDaysDifference = Math.floor(
                                (currentDate - stripeTransactionDate) / (1000 * 60 * 60 * 24)
                            );

                            if (stripeDaysDifference <= 30) {
                                // Update the user's transactionDate in MongoDB
                                user.transactionDate = stripeTransactionDate;
                                await user.save();

                                // Log in the user
                                sendToken(user, 200, res);
                            } else {
                                return next(new ErrorHandler("Password update required", 401));
                            }
                        } else {
                            return next(new ErrorHandler("No successful payment history found in Stripe", 401));
                        }
                    } else {
                        return next(new ErrorHandler("Invalid Email or Password", 401));
                    }
                } catch (error) {
                    return next(new ErrorHandler("Error communicating with Stripe", 500));
                }
            }
        } else {
            return next(new ErrorHandler("Invalid Email or Password", 400));
        }
    } else {
        // If the user is not found in MongoDB, check in Stripe transactions as before
        try {
            const stripeCustomers = await stripeInstance.customers.list({ email: email });
            if (stripeCustomers && stripeCustomers.data.length > 0) {
                const stripeCustomer = stripeCustomers.data[0];
                const stripeName = stripeCustomer.name
                // Check the latest transaction in Stripe
                const customerPayments = await stripeInstance.paymentIntents.list({
                    customer: stripeCustomer.id,
                    limit: 1, // Limit to the latest payment
                });

                if (
                    customerPayments &&
                    customerPayments.data.length > 0 &&
                    customerPayments.data[0].status === "succeeded"
                ) {
                    const currentDate = new Date();
                    const latestPayment = customerPayments.data[0];
                    const stripeTransactionDate = new Date(latestPayment.created * 1000);
                    const stripeCurrentPlan = latestPayment.description;
                    const stripeTransactionId = latestPayment.id;
                    const stripeCurrency = latestPayment.currency
                    const stripeAmount = latestPayment.amount
                    const stripeDaysDifference = Math.floor(
                        (currentDate - stripeTransactionDate) / (1000 * 60 * 60 * 24)
                    );

                    if (stripeDaysDifference <= 30) {
                        // Log in with Stripe data and update transactionDate in MongoDB
                        const newUser = new User({
                            name: stripeName,
                            email,
                            password: "12345678", // Reset password to "12345678"
                            transactionDate: stripeTransactionDate, // Update transaction date
                            plan: stripeCurrentPlan,
                            transactionId: stripeTransactionId,
                            currency: stripeCurrency,
                            amount: stripeAmount
                        });
                        await newUser.save();
                        sendToken(newUser, 200, res);
                    } else {
                        return next(new ErrorHandler("Password update required", 401));
                    }
                } else {
                    return next(new ErrorHandler("No successful payment history found in Stripe", 401));
                }
            } else {
                return next(new ErrorHandler("Invalid Email or Password", 401));
            }
        } catch (error) {
            return next(new ErrorHandler("Error communicating with Stripe", 500));
        }
    }
});

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
        Credential: true,
      sameSite:"None",
        secure:true

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


