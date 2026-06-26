const express = require('express');
const cors = require('cors')
const app = express()
const port = 5000
require('dotenv').config()

app.use(cors())
app.use(express.json())
const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.get('/', (req, res) => {
  res.send('Hello World!')
})



const uri = process.env.MONGODB_URI
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
    const usercommentCollection = database.collection("usercomment");


    app.get('/api/arts', async (req, res) => {
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





    app.post('/api/arts', async (req, res) => {
      const art = req.body;
      console.log(art);
      const result = await artsCollection.insertOne(art)
      res.send(result)

    })





    app.get("/api/artworks/:id/comments", async (req, res) => {
      try {
        const artworkId = req.params.id;
        const comments = await usercommentCollection
          .find({ artworkId })
          .sort({ createdAt: -1 })
          .toArray();
        res.json(comments);
      } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ error: "Failed to fetch comments" });
      }
    });





    app.get("/api/artworks/:id/purchased-check", async (req, res) => {
      try {
        const artworkId = req.params.id;
        const userId = req.query.userId;

        const purchase = await artbuynowstorCollection.findOne({
          id: artworkId,
          buynowerId: userId
        });

        res.json({ purchased: !!purchase });
      } catch (error) {
        console.error("Error checking purchase status:", error);
        res.status(500).json({ error: "Failed to check purchase status" });
      }
    });




    app.get('/api/arts/:id', async (req, res) => {
      try {
        const id = req.params.id;
        let query = { _id: id };
        if (ObjectId.isValid(id)) {
          query = { $or: [{ _id: id }, { _id: new ObjectId(id) }] };
        }
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

    app.get('/api/artbuynowstore', async (req, res) => {
      const query = {}
      if (req.query.buynowerId) {
        query.buynowerId = req.query.buynowerId;
      }
      if (req.query.id) {
        query.id = req.query.id
      }
      const cursor = artbuynowstorCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })




    app.get('/api/plans', async (req, res) => {
      const query = {}
      if (req.query.plan_id) {
        query.id = req.query.plan_id
      }
      const plan = await plansCollection.findOne(query)
      res.send(plan)
    })





    app.post('/api/subscriptions', async (req, res) => {
      const data = req.body;
      const subInfo = {
        ...data,
        createdAt: new Date()
      }
      const result = await subscriptionCollection.insertOne(subInfo)

      const filter = { email: data.email }
      const updateDocument = {
        $set: {
          plan: data.planId
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





    app.post('/api/artbuynowstore', async (req, res) => {
      const artbuynowstor = req.body;
      const newArtbuynowstor = {
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




    app.post("/api/artworks/:id/comments", async (req, res) => {
      try {
        const artworkId = req.params.id;
        const { userId, userName, userImage, comment } = req.body;

        // Check if user has purchase record for that artwork
        const purchase = await artbuynowstorCollection.findOne({
          id: artworkId,
          buynowerId: userId
        });

        if (!purchase) {
          return res.status(403).json({ error: "Only users who have purchased this artwork can leave comments." });
        }

        const newComment = {
          artworkId,
          userId,
          userName: userName || "Anonymous",
          userImage: userImage || "",
          comment,
          createdAt: new Date()
        };

        const result = await usercommentCollection.insertOne(newComment);
        res.status(201).json(result);
      } catch (error) {
        console.error("Error creating comment:", error);
        res.status(500).json({ error: "Failed to store comment" });
      }
    });













    app.put("/api/comments/:commentId", async (req, res) => {
      try {
        const commentId = req.params.commentId;
        const { userId, comment } = req.body;

        const existing = await usercommentCollection.findOne({ _id: new ObjectId(commentId) });
        if (!existing) {
          return res.status(404).json({ error: "Comment not found" });
        }
        if (existing.userId !== userId) {
          return res.status(403).json({ error: "Unauthorized to edit this comment" });
        }

        const result = await usercommentCollection.updateOne(
          { _id: new ObjectId(commentId) },
          { $set: { comment, updatedAt: new Date() } }
        );
        res.json(result);
      } catch (error) {
        console.error("Error updating comment:", error);
        res.status(500).json({ error: "Failed to update comment" });
      }
    });






    app.delete("/api/comments/:commentId", async (req, res) => {
      try {
        const commentId = req.params.commentId;
        const userId = req.query.userId || req.body.userId;

        const existing = await usercommentCollection.findOne({ _id: new ObjectId(commentId) });
        if (!existing) {
          return res.status(404).json({ error: "Comment not found" });
        }
        if (existing.userId !== userId) {
          return res.status(403).json({ error: "Unauthorized to delete this comment" });
        }

        const result = await usercommentCollection.deleteOne({ _id: new ObjectId(commentId) });
        res.json(result);
      } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ error: "Failed to delete comment" });
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







    app.put('/api/arts/:id', logger, async (req, res) => {
      try {
        const id = req.params.id;
        let filter = { _id: id };
        if (ObjectId.isValid(id)) {
          filter = { $or: [{ _id: id }, { _id: new ObjectId(id) }] };
        }
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
        let query = { _id: id };
        if (ObjectId.isValid(id)) {
          query = { $or: [{ _id: id }, { _id: new ObjectId(id) }] };
        }
        const result = await artsCollection.deleteOne(query);
        res.json(result);
      } catch (error) {
        console.error("Error deleting art:", error);
        res.status(500).send({ error: "Failed to delete artwork" });
      }
    });







    app.get('/api/top-artists', async (req, res) => {
      try {
        const artists = await usersCollection.find({ role: 'artist' }).toArray();
        const sales = await artbuynowstorCollection.find({}).toArray();
        const artworks = await artsCollection.find({}).toArray();
        const companies = await companyCollection.find({}).toArray();


        const artIdToArtistEmail = {};
        artworks.forEach(art => {
          if (art._id) {
            artIdToArtistEmail[art._id.toString()] = art.artistEmail;
          }
          if (art.id) {
            artIdToArtistEmail[art.id.toString()] = art.artistEmail;
          }
        });


        const companyIdToArtistId = {};
        companies.forEach(comp => {
          if (comp._id) {
            companyIdToArtistId[comp._id.toString()] = comp.userId;
          }
          if (comp.id) {
            companyIdToArtistId[comp.id.toString()] = comp.userId;
          }
        });

        // Calculate sales count for each artist
        const artistsWithSales = artists.map(artist => {
          const artistIdStr = artist._id ? artist._id.toString() : '';
          const artistEmail = artist.email;

          let salesCount = 0;
          sales.forEach(sale => {
            const saleArtId = sale.id || (sale._id ? sale._id.toString() : '');
            const saleCompanyId = sale.companyId;

            let matches = false;

            if (saleArtId && artIdToArtistEmail[saleArtId] === artistEmail) {
              matches = true;
            }

            if (saleCompanyId && companyIdToArtistId[saleCompanyId] === artistIdStr) {
              matches = true;
            }
            if (sale.userId === artistIdStr) {
              matches = true;
            }

            if (matches) {
              salesCount++;
            }
          });

          return {
            ...artist,
            salesCount
          };
        });

        const topArtists = artistsWithSales
          .sort((a, b) => b.salesCount - a.salesCount)
          .slice(0, 3);

        res.json(topArtists);
      } catch (error) {
        console.error("Error fetching top artists:", error);
        res.status(500).send({ error: "Failed to fetch top artists" });
      }
    });


    //conpany data gual post api

    app.get('/api/my/companies', async (req, res) => {

      const query = {};

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

      let query = { _id: id };
      if (ObjectId.isValid(id)) {
        query = { $or: [{ _id: id }, { _id: new ObjectId(id) }] };
      }

      const result = await usersCollection.updateOne(
        query,
        { $set: { role } }
      );

      res.send({
        success: true,
        message: "Role updated successfully",
        result,
      });
    });




    //conpany data gual post api
    app.post('/api/companies', async (req, res) => {
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