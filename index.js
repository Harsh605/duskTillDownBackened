import express from "express"
import mongoose from "mongoose"
import dotenv from "dotenv"
import cors from "cors"
import { Error } from "./middleware/error.js"
import cookieParser from "cookie-parser"
// import cloudinary from "cloudinary"
import bodyParser from "body-parser"
import fileUpload from "express-fileupload"
import reportRoutes from "./routes/ReportRoutes.js"
import userRoutes from "./routes/userRoutes.js"


import session from "express-session"
// import passportSetup from './passport.js'
import passport from 'passport';




dotenv.config()



// unhandled Uncaught Exception   upper hi likhna shi nhi iske upper likha glat to wha se error aa jyega 
// like console.log(hekfhs) 

process.on("uncaughtException", (err) => {
    console.log(`Error: ${err.message}`)
    console.log("Shutting down there server due to unhandled uncaught exception ")
})

const app = express()
const DB_MONGOOSE = process.env.MONGODB_URI
const PORT = process.env.PORT

app.use(cors({
    origin: "https://dusk-till-down-frontened.vercel.app",
    methods: 'PUT, POST, PATCH, DELETE, GET',
    credentials: true,
}))
app.use(express.json({
    limit: '50mb'
}))


app.use(cookieParser())

app.use(
    session({
        secret: "abcdefgh",
        resave: true,
        saveUninitialized: true,
        cookie: {
            secure: true, // Set this to true when using HTTPS
            sameSite: "None", // Adjust this based on your requirements
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());



app.use(bodyParser.urlencoded({ extended: true,limit:'50mb }))
app.use(bodyParser.json({limit: '50mb'}));
app.use(fileUpload())
app.use("/api/v1", reportRoutes)
app.use("/api/v1", userRoutes)
app.use(Error)


mongoose.connect(DB_MONGOOSE)
    .then(
        console.log("Database is connected")
    )
//catch hta diya kyu ki ab humne unhandled error kar liya

// cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET
// })



const server = app.listen(PORT, () => {
    console.log(`The server is connected on PORT: ${PORT}`)
})

// unhandled Promise Rejection
process.on("unhandledRejection", err => {
    console.log(`Error: ${err.message}`)
    console.log("Shutting down there server due to unhandled Promise ")

    server.close(() => {
        process.exit(1)
    })

})

