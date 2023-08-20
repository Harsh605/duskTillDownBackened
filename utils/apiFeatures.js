export class ApiFeatures{
    constructor(query,queryStr){
        this.query = query;
        this.queryStr =queryStr
    }

    // search-Feature
    search(){
        const keyword = this.queryStr.keyword ? {
            name:{
                $regex: this.queryStr.keyword,
                $options: "i"    //yaani case In-Sensative
            }

        }
        :{};
        this.query = this.query.find({...keyword});
        return this
    }

    filter(){
        const queryCopy = {...this.queryStr}
        // removing some fields for category
        const removeFields = ["keyword","page","limit"]
        
        removeFields.forEach((key)=>delete queryCopy[key])

        // filter for price and Rating (2lines)   aage sabke liye                                     //{ price: { lt: '13000', gt: '10000' } }
        let queryStr = JSON.stringify(queryCopy)                                  
        queryStr= queryStr.replace(/\b(gt|gte|lt|lte)\b/g,key=> `$${key}`);    //{"price":{"$lt":"13000","$gt":"10000"}}

        // console.log(queryStr)
        this.query = this.query.find(JSON.parse(queryStr))
        return this
    }

    pagination(resultPerPage){
        const currPage = Number(this.queryStr.page)  || 1

        const skip = resultPerPage *(currPage-1)

        this.query = this.query.limit(resultPerPage).skip(skip)    //limit and skip mongoodb ke method h
        return this
    }

}



