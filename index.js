const express = require('express');
const cors = require('cors')
const app = express()
const port = 5000
require('dotenv').config()

app.use(cors())
app.use(express.json())
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.get('/', (req, res) => {
  res.send('Hello World!')
})



const uri =process.env.MONGODB_URI
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
      const database = client.db("b13_assignment_10_db");
    const artsCollection = database.collection("artstor");
    const usersCollection = database.collection("user");
    const companyCollection = database.collection("companystor");
    const artbuynowstorCollection = database.collection("buynowerstor");
    const plansCollection = database.collection("plans");
    const subscriptionCollection = database.collection("subscriptions");
    const artpurchasesCollection = database.collection("purchasestor");
    

    app.get('/api/arts', async (req, res)=>{
      const result = await artsCollection.find().toArray()
      res.json(result)
    })



app.get("/api/users", async (req, res) => {
  try {
    const users = await usersCollection
      .find({})
      .sort({ _id: -1 })
      .toArray();

    res.send(users);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch users" });
  }
});


    app.get('/api/arts/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await artsCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ error: "Artwork not found" });
        }
        res.json(result);
      } catch (error) {
        console.error("Error getting art by id:", error);
        res.status(500).send({ error: "Failed to fetch artwork" });
      }
    });

    app.get('/api/artbuynowstore', async (req,res)=>{
      const query = {} 
      if(req.query.buynowerId){
        query.buynowerId = req.query.buynowerId;
      }
      if(req.query.id){
        query.id = req.query.id
      }
      const cursor = artbuynowstorCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })


    app.get('/api/plans',async (req, res)=>{
      const query = {}
      if(req.query.plan_id){
        query.id = req.query.plan_id
      }
      const plan = await plansCollection.findOne(query)
      res.send(plan)
    })


  app.post('/api/subscriptions', async (req,res)=>{
    const data  = req.body;
    const subInfo ={
      ...data, 
      createdAt: new Date()
    }
    const result = await subscriptionCollection.insertOne(subInfo)

    const filter = {email : data.email}
    const updateDocument ={
      $set:{
        plan:data.planId
      }
    }
    const updateResult = await usersCollection.updateOne(filter, updateDocument)
    res.send(updateResult)
  

  })

  app.get('/api/subscriptions', async (req, res) => {
    try {
      const result = await subscriptionCollection.find().toArray();
      res.json(result);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).send({ error: "Failed to fetch subscriptions" });
    }
  });


    app.post('/api/artbuynowstore', async (req,res)=>{
      const artbuynowstor = req.body;
      const newArtbuynowstor ={
        ...artbuynowstor,
        createdAt: new Date()
      }
      const result = await artbuynowstorCollection.insertOne(newArtbuynowstor);
      res.send(result)
    })

    app.post('/api/purchases', async (req, res) => {
      try {
        const purchaseData = req.body;
        const newPurchase = {
          ...purchaseData,
          purchaseDate: new Date()
        };
        const result = await artpurchasesCollection.insertOne(newPurchase);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error creating purchase:", error);
        res.status(500).send({ error: "Failed to store purchase" });
      }
    });

    app.get('/api/purchases', async (req, res) => {
      try {
        const result = await artpurchasesCollection.find().toArray();
        res.json(result);
      } catch (error) {
        console.error("Error fetching purchases:", error);
        res.status(500).send({ error: "Failed to fetch purchases" });
      }
    });





    app.put('/api/arts/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedArt = req.body;
        const { _id, ...updateData } = updatedArt;
        const updateDoc = {
          $set: updateData
        };
        const result = await artsCollection.updateOne(filter, updateDoc);
        res.json(result);
      } catch (error) {
        console.error("Error updating art:", error);
        res.status(500).send({ error: "Failed to update artwork" });
      }
    });





    app.delete('/api/arts/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await artsCollection.deleteOne(query);
        res.json(result);
      } catch (error) {
        console.error("Error deleting art:", error);
        res.status(500).send({ error: "Failed to delete artwork" });
      }
    });






    app.post('/api/arts' ,async(req, res)=>{
        const art = req.body;
        console.log(art);
        const result = await artsCollection.insertOne(art)
        res.send(result)
        
    })





    //conpany data gual post api

    app.get('/api/my/companies', async (req, res) => {
  
    const query = {  }; 

    if (req.query.userId) {
        query.userId = req.query.userId;
    }

    const result = await companyCollection.find(query).toArray();
    res.send(result);
});





app.post("/api/users/role/:id", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ["admin", "artist", "buyer"];

  if (!validRoles.includes(role)) { 
    return res.status(400).send({ message: "Invalid role" });
  }

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { role } }
  );

  res.send({
    success: true,
    message: "Role updated successfully",
    result,
  });
});
    



    //conpany data gual post api
    app.post('/api/companies' ,async(req, res)=>{
        const data = req.body;
        console.log("Incoming company data:", data);
        
        if (!data.userId) {
            return res.status(400).send({ error: "userId is required" });
        }

        const filter = { userId: data.userId };
        const updateDoc = {
            $set: {
                companyName: data.companyName,
                category: data.category,
                website: data.website,
                location: data.location,
                employeeCountRange: data.employeeCountRange,
                companyLogo: data.companyLogo,
                description: data.description,
            }
        };
        
        try {
            const result = await companyCollection.updateOne(filter, updateDoc, { upsert: true });
            
            const responseData = {
                acknowledged: result.acknowledged,
                insertedId: result.upsertedId || (result.matchedCount > 0 ? "updated" : null),
                isUpdate: result.matchedCount > 0
            };
            
            res.send(responseData);
        } catch (error) {
            console.error("Error upserting company data:", error);
            res.status(500).send({ error: "Failed to save company profile" });
        }
    })


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})