import mongoose from 'mongoose';

const GenealogyReportSchema = new mongoose.Schema({
    currentPointsReport: [
        {
            Level: String,
            PaidLevel: String,
            Name: String,
            ID: String,
            City: String,
            State: String,
            Address: String,
            Phone: String,
            Email: String,
            SponsorID: String,
            SponsorName: String,
            CustomerType: String,
            HighestAchievedRank: String,
            PaidRank: String,
            Points: String,
            PV: Number,
            NewAmbassadors: String,
            CancelledAmbassadors: String,
            WelcomePack: String,
            OrgVolume: String,
            JoinDate: String,
            UpgradeDate: String,
            RenewalDate: String,
            CommissionQualified: String,
            NextSubscription: String,
            SubscriptionStatusOn: String,
            SubscriptionPV: String

        } 
    ],
    vipCustomerLevel1: [
        {
            Level: String,
            Name: String,
            ID: String,
            Phone: String,
            Email: String,
            SponsorName: String,
            CustomerType: String,
            PV: Number,
            WelcomePack: String,
            JoinDate: String,
            NextSubscription: String,
            SubscriptionPV: String
        } 
    ],
    vipCustomerLevel2: [
        {
            Level: String,
            Name: String,
            ID: String,
            Phone: String,
            Email: String,
            SponsorName: String,
            CustomerType: String,
            PV: Number,
            WelcomePack: String,
            JoinDate: String,
            NextSubscription: String,
            SubscriptionPV: String
        }
        
    ],
    newBrandAmbassadors: [
        {
            Level: String,
            Name: String,
            ID: String,
            Phone: String,
            Email: String,
            SponsorName: String,
            CustomerType: String,
            PV: Number,
            WelcomePack: String,
            JoinDate: String,
            UpgradeDate: String,
            NextSubscription: String,
            SubscriptionPV: String
        }
        
    ],
    vipCustomerLevel1Count: Number,
    vipCustomerLevel2Count: Number,
    newBrandAmbassadorsCount:Number,
    currentPoints: Number,
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: true,
    },

});

const GenealogyReport = mongoose.model('GenealogyReportData', GenealogyReportSchema);

export default GenealogyReport;
