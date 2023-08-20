import mongoose from 'mongoose';

const RankAdvancementSchema = new mongoose.Schema({

    newRanksReport: [
        {
            CustomerID: String,
            FirstName: String,
            LastName: String,
            Phone: Number,
            Email: String,
            SponsorID: String,
            SponsorFirstName: String,
            SponsorLastName: String,
            Level: String,
            ProjectedRank: String,
            
            
        }
        
    ],
    newRanks: Number,
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: true,
    },

});

const RankAdvancement = mongoose.model('RankAdvancementData', RankAdvancementSchema);

export default RankAdvancement;
