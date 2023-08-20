import mongoose from "mongoose"
import validator from "validator"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import crypto from "crypto"

const userSchema = new mongoose.Schema({
  
    name:{
        type: String,
    },
    email:{
        type: String,
        required:[true,"Please Enter Your Email"],
        unique: true,
        validate: [validator.isEmail,"Please Enter a valid Email"]
    },
    password:{
        type: String,
        required:[true,"Please Enter Your Password"],
        select: false      //yaani password User m nhi milegi
    },
    role:{
        type:String,
        default: "user"
    },
    plan:{
        type:String,
    },
    plexusAmbassadorId:{
        type:String,
    },
    rank:{
        type:String,
    },

    createdAt:{
        type: Date,
        default: Date.now
    },

    resetPasswordToken: String,
    resetPasswordExpire: Date,
})

// userSchema.pre("save", async function (next) {
//     if (!this.isModified("password")) {                                    //chuki hum 2 tarike se update karne bale h jisme only name and photo update krenge or ek password recovery karke to isliye 
//       next();
//     }
  
//     this.password = await bcrypt.hash(this.password, 10);
//   });

userSchema.methods.getJwtToken = function(){
return jwt.sign({id:this._id},process.env.JWT_SECRET_KEY,{
    expiresIn: process.env.JWT_EXPIRE
})
}

// userSchema.methods.comparePassword = async function (password) {
//     return await bcrypt.compare(password, this.password);
//   };

// userSchema.methods.getResetPasswordToken = async function(req,res,next){
//     const resetToken = crypto.randomBytes(20).toString("hex")
//     // Hashing and add to userSchema
//     this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex")
//     this.resetPasswordExpire= Date.now()+ 15*60*60*1000
//     return resetToken
// }


const User = mongoose.model("User",userSchema)



export default User
