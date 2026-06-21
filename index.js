const express=require('express');
const app=express();
const cors=require("cors");
const admin = require("firebase-admin");

require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port=process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json())

// Firebase
const decoded=Buffer.from(process.env.FB_SERVICE_KEY,"base64").toString(
    "utf8"
);

const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// firebase verify toke
const verifyToken=async(req,res,next) =>{
    const authHeader=req.headers.authorization;
    if(!authHeader){
        return res.status(401).send({
            message:"Unauthorized"
        });
    }
const token=authHeader.split(" ")[1];
if(!token){
    return res.status(401).send({
        message:"Unauthorized"
    })
}
try{
    const decoded=await admin.auth().verifyIdToken(token);
    req.decoded=decoded
    next()
}catch{
    return res.status(403).send({
        message:"Forbidden"
    });
}
};


// mongoDB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.due0kmg.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/',(req,res) =>{
    res.send("server is running")
})

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

// create a database collection
const database=client.db("reviewsdb");
const reviewsColl=database.collection("reviews");
const favoriteColl=database.collection("favorite")


// --------Review api------

// get all review api
app.get('/search',async(req,res) =>{
try{ 
    const reviews=req.query.reviews || "";
  
    const query={}
    // search by name
    if(reviews){
        query.foodName={
            $regex:reviews,
            $options:"i"

        };
        
    }
    
   const result=await reviewsColl.find(query).sort({createdAt:-1}).toArray()
   res.send(result)
    }catch(error){
console.error("Error fetching reviews",error)
res.status(500).send({message:"Error fetching reviews"})
    }

   
});

// post review api(add review)
app.post("/reviews",async(req,res) =>{
    const newReviews=req.body;
    const result=await reviewsColl.insertOne(newReviews);
    res.send(result);
})

// get latest reviews api
app.get('/latestreviews',async(req,res) =>{
    sortField={rating:-1}
    const limitNum=5;
    const cursor=reviewsColl.find().sort(sortField).limit(limitNum);
    const result=await cursor.toArray()
    res.send({
        success:true,
        data:result
    })
})

// get specific data by id for reviewDetails page
app.get('/reviews/:id',async(req,res) =>{
    const id=req.params.id;
    const query ={
        _id:new ObjectId(id)
    };
    const result=await reviewsColl.findOne(query)
    res.send({
        success:true,
        data:result
    })
})

// get reviews who sign in
app.get("/users/reviews",async(req,res) =>{
    const email=req.query.email;
    const query={}
    if(email){
        query.reviewerEmail=email
    }
    const result=await reviewsColl.find(query).toArray();
    res.send({
        success:true,
        data:result
    });
})

// Edit the review api
app.patch('/reviews/:id',async(req,res) =>{
    const id=req.params.id;
    const updateData=req.body;
    const result=await reviewsColl.updateOne(
        {
            _id:new ObjectId(id)
        },
        {
            $set:updateData,
        },
    )
            res.send(result)

})
// Delete the review api
app.delete("/reviews/:id" ,async(req,res)=>{
    const id=req.params.id;
    const result=await reviewsColl.deleteOne({
        _id:new ObjectId(id),
    })
    res.send({
        success:true,
        data:result
    })
})
// favorite review api

// favorite review post api
app.post('/favorite',async(req,res)=>{
    const favorite=req.body;
    favorite.reviewId=new ObjectId(favorite.reviewId)
    const exists=await favoriteColl.findOne({
        reviewId:favorite.reviewId,
        userEmail:favorite.userEmail,
    })
    if(exists){
        return res.send({
            success:false,
            message:'Already in favorite'
        })
    }
    const result=await favoriteColl.insertOne(favorite)
    res.send({
        success:true,
        result
    });
});







// get all favorite review
app.get("/favorite",async(req,res) =>{
    const email=req.query.email;
    const result=await favoriteColl
    .aggregate(
        [
            {
                $match:{userEmail:email}
            },
            {
                $lookup:{
                    from:"reviews",
                    localField:"reviewId",
                    foreignField:"_id",
                    as:"reviewData"
                },
            },
            {
                $unwind:"$reviewData"
            }
        ]
    ).toArray()
    res.send({
        success:true,
        data:result
    })
})

// Delete favorite review api
app.delete('/favorite/:id',async(req,res)=>{
    const id=req.params.id;
    const result=await favoriteColl.deleteOne({
        _id:new ObjectId(id)
    })
    res.send({
        success:true,
        data:result
    })
})





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
app.listen(port, ()=>{
    console.log(`app listening on port ${port}`)
})
run().catch(console.dir);

