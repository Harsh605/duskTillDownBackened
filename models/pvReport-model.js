import mongoose from 'mongoose';

const pvReportSchema = new mongoose.Schema({
    // Define the properties you want to store
    pvReport: [
        {
            customerID: String,
            firstName: String,
            lastName: String,
            PV: Number,
            email: String,
            phone: String
        }

    ],
    retailReport: [
        {
            customerID: String,
            firstName: String,
            lastName: String,
            PV: Number,
            email: String,
            phone: String
        },

    ],
    currentPv: Number,
    newRetails: Number,
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: true,
    },

    // ... add other properties as needed
});

const PvReport = mongoose.model('PvReportData', pvReportSchema);

export default PvReport;
