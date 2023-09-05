import mongoose from 'mongoose';

const PointsAndRankupSchema = new mongoose.Schema({
    // Define the properties you want to store
    monthNo: Number,

    ordersMonthlyReport: [
        {
            CustomerID: String,
            FirstName: String,
            LastName: String,
            Phone: String,
            Email: String,
            SponsorID: String,
            SponsorFirstName: String,
            SponsorLastName: String,
            Level: Number,
            PersonalVolume: String,
            NextAutoOrder: String,
            OrderIDList: String,
        }

    ],
    filterdDataForCreditCardReport: [
        {
            CustomerID: String,
            FirstName: String,
            LastName: String,
            Phone: String,
            Email: String,
            SponsorID: String,
            SponsorFirstName: String,
            SponsorLastName: String,
            Level: Number,
            PersonalVolume: String,
            NextAutoOrder: String,
            OrderIDList: String,
            CustomerType: String,
        }

    ],
    legNamesArrayReport: [
        {
            LegName: String,
            PlexusPointsInOrganization: Number,
        }

    ],
    top8RowsLegsReport: [
        {
            LegName: String,
            PlexusPointsInOrganization: Number,
        }

    ],
    topRecruitersReport: [
        {
            SponsorName: String,
            TopNewVip: Number,
        }

    ],
    topLeadersWithNewAmbassadorsReport: [
        {
            SponsorName: String,
            newAmbassadors: Number,
        }

    ],
    newBrandAmbassadorReport: [
        {
            CustomerID: String,
            FirstName: String,
            LastName: String,
            Phone: String,
            Email: String,
            SponsorID: String,
            SponsorFirstName: String,
            SponsorLastName: String,
            CustomerType:String,
            Level: Number,
            PersonalVolume: String,
            NextAutoOrder: String,
            OrderIDList: String,
        }

    ],
    currentPointsReport: [
        {
            CustomerID: String,
            FirstName: String,
            LastName: String,
            Phone: String,
            Email: String,
            SponsorID: String,
            SponsorFirstName: String,
            SponsorLastName: String,
            CustomerType:String,
            Level: Number,
            PersonalVolume: String,
            NextAutoOrder: String,
            OrderIDList: String,
            PlexusPointsInOrganization: String,
        }

    ],
    Lvl1VipsReport: [
        {
            CustomerID: String,
            FirstName: String,
            LastName: String,
            Phone: String,
            Email: String,
            SponsorID: String,
            SponsorFirstName: String,
            SponsorLastName: String,
            CustomerType:String,
            Level: Number,
            PersonalVolume: String,
            NextAutoOrder: String,
            OrderIDList: String,
            PlexusPointsInOrganization: String,
            CreatedDate: String,
            JoinDate: String,
        }

    ],
    Lvl2PlusVipsReport: [
        {
            CustomerID: String,
            FirstName: String,
            LastName: String,
            Phone: String,
            Email: String,
            SponsorID: String,
            SponsorFirstName: String,
            SponsorLastName: String,
            CustomerType:String,
            Level: Number,
            PersonalVolume: String,
            NextAutoOrder: String,
            OrderIDList: String,
            PlexusPointsInOrganization: String,
            CreatedDate: String,
            JoinDate: String,
        }

    ],
    monthlyOrders: Number,
    level2PlusVipsCount: Number,
    level1VipsCount: Number,
    creditCardDeclineRate: Number,
    totalCurrentPoints: Number,
    fullyCompressedPointsValue: Number,
    averageCompressionBonus: Number,
    totalPointsFromSubscription: Number,
    forcastingDeclineRate: Number,
    subscriptionOnlyEstimate: Number,
    pointsGainedLastMonthWithoutSubs: Number,
    pointsGainedThisMonthWithoutSubs: Number,
    estimatedPointsComingFromDiscretionaryOrders: Number,
    forecastedEstimate: Number,
    totalOrderProceedThisMonth: Number,
    suspectedSubsDeclinedThisMonth: Number,
    suspectedSubsDeclinedLastMonth: Number,
    totalPlexusPoints: Number,
    newVipsTotal: Number,
    pointsFromNewVips: Number,
    lastMonthVipsTotal: Number,
    lastMonthPointsFromNewVips: Number,
    newBrandAmbassadorsCount: Number,
    ptsWorthForRetention: {
        type: Map,
        of: Number,
    },

    orderedLastMonthForRetention: {
        type: Map,
        of: Number,
    },

    recordedThisMonthForRetention: {
        type: Map,
        of: Number,
    },
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: true,
    },
    totalPersonalVolume: Number




    // ... add other properties as needed
});

const PointsAndRankup = mongoose.model('PointsAndRankupData', PointsAndRankupSchema);

export default PointsAndRankup;
