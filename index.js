const express = require('express');
const cors = require('cors')
const app = express()
const port = process.env.PORT || 5000;
require('dotenv').config({ quiet: true })

app.use(cors())
app.use(express.json())
const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};

const jwt = require('jsonwebtoken');

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'Unauthorized access: token missing' });
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET || 'supersecret_b13_assignment_10', (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: true, message: 'Forbidden access: invalid token' });
    }
    req.decoded = decoded;
    next();
  });
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
    
    // await client.connect();
    
    const database = client.db("b13_assignment_10_db");
    const artsCollection = database.collection("artstor");
    const usersCollection = database.collection("user");
    const companyCollection = database.collection("companystor");
    const artbuynowstorCollection = database.collection("buynowerstor");
    const plansCollection = database.collection("plans");
    const subscriptionCollection = database.collection("subscriptions");
    const artpurchasesCollection = database.collection("purchasestor");
    const usercommentCollection = database.collection("usercomment");
    const useraddressCollection = database.collection("useraddress");
    const cartCollection = database.collection("usercart");


    app.get('/api/arts', async (req, res) => {
      try {
        const arts = await artsCollection.find().toArray();
        const comments = await usercommentCollection.find({}).toArray();

        // Calculate ratings per artwork
        const ratingsMap = {};
        comments.forEach((c) => {
          const artId = String(c.artworkId || c.artId || "");
          if (!artId) return;
          if (!ratingsMap[artId]) {
            ratingsMap[artId] = { sum: 0, count: 0 };
          }
          const r = Math.min(5, Math.max(1, Number(c.rating) || 5));
          ratingsMap[artId].sum += r;
          ratingsMap[artId].count += 1;
        });

        const enrichedArts = arts.map((art) => {
          const artId = String(art._id || art.id || "");
          const rData = ratingsMap[artId];
          if (rData && rData.count > 0) {
            return {
              ...art,
              rating: Number((rData.sum / rData.count).toFixed(1)),
              reviewsCount: rData.count,
              hasReviews: true
            };
          }
          return {
            ...art,
            rating: art.rating ? Number(art.rating) : 5.0,
            reviewsCount: art.reviewsCount ? Number(art.reviewsCount) : 0,
            hasReviews: false
          };
        });

        res.json(enrichedArts);
      } catch (error) {
        console.error("Error fetching arts:", error);
        res.status(500).json({ error: "Failed to fetch artworks" });
      }
    });





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

    app.get("/api/users/by-email", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ error: "Email query param required" });
        }
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ error: "User not found" });
        }
        res.json(user);
      } catch (error) {
        console.error("Error fetching user by email:", error);
        res.status(500).send({ error: "Failed to fetch user" });
      }
    });





    app.post('/api/arts', verifyJWT, async (req, res) => {
      const art = req.body;
      console.log(art);
      const result = await artsCollection.insertOne(art)
      res.send(result)

    })





    // GET comments & ratings for an artwork
    app.get("/api/artworks/:id/comments", async (req, res) => {
      try {
        const artworkId = req.params.id;
        const comments = await usercommentCollection
          .find({
            $or: [
              { artworkId: artworkId },
              { artworkId: String(artworkId) },
              { artId: artworkId },
              { artId: String(artworkId) }
            ]
          })
          .sort({ createdAt: -1 })
          .toArray();

        // Calculate statistics
        const totalReviews = comments.length;
        let ratingSum = 0;
        const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const photoReviews = [];

        comments.forEach((c) => {
          const r = Math.min(5, Math.max(1, Number(c.rating) || 5));
          ratingSum += r;
          ratingCounts[r] = (ratingCounts[r] || 0) + 1;
          if (Array.isArray(c.reviewImages) && c.reviewImages.length > 0) {
            photoReviews.push(...c.reviewImages);
          } else if (c.reviewImage) {
            photoReviews.push(c.reviewImage);
          }
        });

        const averageRating = totalReviews > 0 ? Number((ratingSum / totalReviews).toFixed(1)) : 5.0;

        res.json({
          comments,
          stats: {
            totalReviews,
            averageRating,
            ratingCounts,
            photoReviewsCount: photoReviews.length,
            photoReviews
          }
        });
      } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ error: "Failed to fetch comments" });
      }
    });

    // Helper route to get all artworks ratings summary for cards
    app.get("/api/artworks-ratings-summary", async (req, res) => {
      try {
        const comments = await usercommentCollection.find({}).toArray();
        const summary = {};

        comments.forEach((c) => {
          const artId = c.artworkId || c.artId;
          if (!artId) return;
          if (!summary[artId]) {
            summary[artId] = { count: 0, sum: 0, avg: 5.0 };
          }
          const r = Math.min(5, Math.max(1, Number(c.rating) || 5));
          summary[artId].count += 1;
          summary[artId].sum += r;
          summary[artId].avg = Number((summary[artId].sum / summary[artId].count).toFixed(1));
        });

        res.json(summary);
      } catch (error) {
        console.error("Error fetching ratings summary:", error);
        res.status(500).json({});
      }
    });

    // Check if user has purchased this artwork
    app.get("/api/artworks/:id/purchased-check", async (req, res) => {
      try {
        const artworkId = req.params.id;
        const userId = req.query.userId ? String(req.query.userId).trim() : null;
        const userEmail = req.query.email ? String(req.query.email).trim() : null;

        if (!userId && !userEmail) {
          return res.json({ purchased: false });
        }

        const idMatches = [artworkId, String(artworkId)];
        if (ObjectId.isValid(artworkId)) {
          idMatches.push(new ObjectId(artworkId));
        }

        const userConditions = [];
        if (userId) {
          userConditions.push({ buynowerId: userId });
          userConditions.push({ userId: userId });
          userConditions.push({ buyerId: userId });
        }
        if (userEmail) {
          const escaped = escapeRegex(userEmail);
          userConditions.push({ buynowerEmail: { $regex: new RegExp(`^${escaped}$`, 'i') } });
          userConditions.push({ userEmail: { $regex: new RegExp(`^${escaped}$`, 'i') } });
          userConditions.push({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } });
          userConditions.push({ buyerEmail: { $regex: new RegExp(`^${escaped}$`, 'i') } });
        }

        const artFilter = {
          $or: [
            { id: { $in: idMatches } },
            { art_id: { $in: idMatches } },
            { artworkId: { $in: idMatches } },
            { artId: { $in: idMatches } },
            { _id: { $in: idMatches } }
          ]
        };

        const purchase1 = await artbuynowstorCollection.findOne({
          ...artFilter,
          $or: userConditions
        });

        if (purchase1) {
          return res.json({ purchased: true });
        }

        const purchase2 = await artpurchasesCollection.findOne({
          ...artFilter,
          $or: userConditions
        });

        res.json({ purchased: !!purchase2 });
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

        const comments = await usercommentCollection.find({
          $or: [
            { artworkId: id },
            { artworkId: String(id) },
            { artId: id },
            { artId: String(id) }
          ]
        }).toArray();

        if (comments.length > 0) {
          const sum = comments.reduce((acc, c) => acc + Math.min(5, Math.max(1, Number(c.rating) || 5)), 0);
          result.rating = Number((sum / comments.length).toFixed(1));
          result.reviewsCount = comments.length;
          result.hasReviews = true;
        } else {
          result.rating = result.rating ? Number(result.rating) : 5.0;
          result.reviewsCount = 0;
          result.hasReviews = false;
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
      try {
        const planId = req.query.plan_id;
        let query = {};
        if (planId) {
          query = { id: { $regex: new RegExp(`^${planId}$`, 'i') } };
        }
        let plan = await plansCollection.findOne(query);

        if (!plan && planId) {
          const pId = String(planId).toLowerCase();
          if (pId.includes('premium')) {
            plan = { name: 'Premium', id: 'buynower_Premium', maxPurchaseMoth: 999999, price: 19.99 };
          } else if (pId.includes('pro')) {
            plan = { name: 'Pro', id: 'buynower_Pro', maxPurchaseMoth: 9, price: 9.99 };
          } else {
            plan = { name: 'Free', id: 'buynower_free', maxPurchaseMoth: 3, price: 0 };
          }
        }
        res.send(plan);
      } catch (error) {
        console.error("Error fetching plan:", error);
        res.status(500).send({ error: "Failed to fetch plan" });
      }
    });

    app.post('/api/subscriptions', async (req, res) => {
      try {
        const data = req.body;
        if (!data.email || !data.planId) {
          return res.status(400).send({ error: "Missing email or planId" });
        }
        const subInfo = {
          ...data,
          createdAt: new Date()
        };
        const result = await subscriptionCollection.insertOne(subInfo);

        const filter = { email: { $regex: new RegExp(`^${data.email.trim()}$`, 'i') } };
        const updateDocument = {
          $set: {
            plan: data.planId
          }
        };
        const updateResult = await usersCollection.updateMany(filter, updateDocument);
        res.send({ success: true, result, updateResult });
      } catch (err) {
        console.error("Error creating subscription:", err);
        res.status(500).send({ error: err.message });
      }
    });

    app.get('/api/subscriptions', async (req, res) => {
      try {
        const query = {};
        if (req.query.email) {
          query.email = { $regex: new RegExp(`^${req.query.email.trim()}$`, 'i') };
        }
        const result = await subscriptionCollection.find(query).sort({ _id: -1 }).toArray();
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






    app.post('/api/purchases', verifyJWT, async (req, res) => {
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
        const { userId, userEmail, userName, userImage, comment, rating, reviewImages, recommend } = req.body;

        if (!comment || !comment.trim()) {
          return res.status(400).json({ error: "Review comment cannot be empty." });
        }

        const idMatches = [artworkId, String(artworkId)];
        if (ObjectId.isValid(artworkId)) {
          idMatches.push(new ObjectId(artworkId));
        }

        const userConditions = [];
        if (userId) {
          userConditions.push({ buynowerId: userId });
          userConditions.push({ userId: userId });
          userConditions.push({ buyerId: userId });
        }
        if (userEmail) {
          const escaped = escapeRegex(userEmail);
          userConditions.push({ buynowerEmail: { $regex: new RegExp(`^${escaped}$`, 'i') } });
          userConditions.push({ userEmail: { $regex: new RegExp(`^${escaped}$`, 'i') } });
          userConditions.push({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } });
          userConditions.push({ buyerEmail: { $regex: new RegExp(`^${escaped}$`, 'i') } });
        }

        const artFilter = {
          $or: [
            { id: { $in: idMatches } },
            { art_id: { $in: idMatches } },
            { artworkId: { $in: idMatches } },
            { artId: { $in: idMatches } },
            { _id: { $in: idMatches } }
          ]
        };

        let purchase = null;
        if (userConditions.length > 0) {
          purchase = await artbuynowstorCollection.findOne({
            ...artFilter,
            $or: userConditions
          });

          if (!purchase) {
            purchase = await artpurchasesCollection.findOne({
              ...artFilter,
              $or: userConditions
            });
          }
        }

        if (!purchase) {
          return res.status(403).json({ error: "Only verified buyers who have purchased this artwork can leave reviews & ratings." });
        }

        // Validate images array
        let processedImages = [];
        if (Array.isArray(reviewImages)) {
          processedImages = reviewImages.filter((img) => typeof img === "string" && img.trim().length > 0);
        } else if (typeof reviewImages === "string" && reviewImages.trim()) {
          processedImages = [reviewImages.trim()];
        }

        const parsedRating = Math.min(5, Math.max(1, Number(rating) || 5));

        const newComment = {
          artworkId: String(artworkId),
          artId: String(artworkId),
          userId: userId || "",
          userEmail: userEmail || "",
          userName: userName || "Verified Collector",
          userImage: userImage || "",
          rating: parsedRating,
          reviewImages: processedImages,
          comment: comment.trim(),
          recommend: recommend !== false,
          isVerifiedBuyer: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await usercommentCollection.insertOne(newComment);
        res.status(201).json({ success: true, insertedId: result.insertedId, review: newComment });
      } catch (error) {
        console.error("Error creating comment:", error);
        res.status(500).json({ error: "Failed to store review" });
      }
    });

    app.put("/api/comments/:commentId", async (req, res) => {
      try {
        const commentId = req.params.commentId;
        const { userId, userEmail, comment, rating, reviewImages, recommend } = req.body;

        let query = { _id: commentId };
        if (ObjectId.isValid(commentId)) {
          query = { $or: [{ _id: commentId }, { _id: new ObjectId(commentId) }] };
        }

        const existing = await usercommentCollection.findOne(query);
        if (!existing) {
          return res.status(404).json({ error: "Review not found" });
        }

        if (userId && existing.userId && existing.userId !== userId && userEmail && existing.userEmail !== userEmail) {
          return res.status(403).json({ error: "Unauthorized to edit this review" });
        }

        const updateDoc = {
          updatedAt: new Date()
        };

        if (comment !== undefined) updateDoc.comment = String(comment).trim();
        if (rating !== undefined) updateDoc.rating = Math.min(5, Math.max(1, Number(rating) || 5));
        if (recommend !== undefined) updateDoc.recommend = Boolean(recommend);
        if (reviewImages !== undefined) {
          updateDoc.reviewImages = Array.isArray(reviewImages)
            ? reviewImages.filter((img) => typeof img === "string" && img.trim().length > 0)
            : [];
        }

        const result = await usercommentCollection.updateOne(query, { $set: updateDoc });
        res.json({ success: true, modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error("Error updating comment:", error);
        res.status(500).json({ error: "Failed to update review" });
      }
    });

    app.delete("/api/comments/:commentId", async (req, res) => {
      try {
        const commentId = req.params.commentId;
        const userId = req.query.userId || req.body?.userId;
        const userEmail = req.query.email || req.body?.email;

        let query = { _id: commentId };
        if (ObjectId.isValid(commentId)) {
          query = { $or: [{ _id: commentId }, { _id: new ObjectId(commentId) }] };
        }

        const existing = await usercommentCollection.findOne(query);
        if (!existing) {
          return res.status(404).json({ error: "Review not found" });
        }

        if (userId && existing.userId && existing.userId !== userId && userEmail && existing.userEmail !== userEmail) {
          return res.status(403).json({ error: "Unauthorized to delete this review" });
        }

        const result = await usercommentCollection.deleteOne(query);
        res.json({ success: true, deletedCount: result.deletedCount });
      } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ error: "Failed to delete review" });
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







    app.put('/api/arts/:id', logger, verifyJWT, async (req, res) => {
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





    app.delete('/api/arts/:id', verifyJWT, async (req, res) => {
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





    app.post("/api/users/role/:id", verifyJWT, async (req, res) => {
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
    app.post('/api/companies', verifyJWT, async (req, res) => {
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
    });

    // ==========================================
    // USER ADDRESS COLLECTION APIs (CRUD)
    // ==========================================
    const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const buildAddressFilter = (email, userId) => {
      const orConditions = [];
      if (email && String(email).trim()) {
        const escaped = escapeRegex(String(email).trim());
        orConditions.push({ userEmail: { $regex: new RegExp(`^${escaped}$`, 'i') } });
        orConditions.push({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } });
      }
      if (userId && String(userId).trim()) {
        orConditions.push({ userId: String(userId).trim() });
      }
      return orConditions.length > 0 ? { $or: orConditions } : {};
    };

    app.get('/api/useraddress', async (req, res) => {
      try {
        const filter = buildAddressFilter(req.query.email, req.query.userId);
        const addresses = await useraddressCollection.find(filter).sort({ isDefault: -1, _id: -1 }).toArray();
        res.json(addresses);
      } catch (error) {
        console.error("Error fetching user addresses:", error);
        res.status(500).send({ error: "Failed to fetch addresses" });
      }
    });

    app.post('/api/useraddress', async (req, res) => {
      try {
        const data = req.body || {};
        const street = data.street || data.address || data.landmark || "";
        const fullName = data.fullName || data.name || "";
        const phone = data.phone || "";

        if (!street || !fullName || !phone) {
          return res.status(400).send({ error: "Required address fields (fullName, phone, street) are missing" });
        }

        const userEmail = (data.userEmail || data.email || "").trim();
        const userId = (data.userId || data.id || "").trim();
        const emailFilter = buildAddressFilter(userEmail, userId);

        let shouldBeDefault = data.isDefault === true;
        if (Object.keys(emailFilter).length > 0) {
          const existingCount = await useraddressCollection.countDocuments(emailFilter);
          if (existingCount === 0) {
            shouldBeDefault = true;
          }
          if (shouldBeDefault) {
            await useraddressCollection.updateMany(emailFilter, { $set: { isDefault: false } });
          }
        } else {
          shouldBeDefault = true;
        }

        const newAddress = {
          userId: userId,
          userEmail: userEmail,
          email: userEmail,
          fullName: fullName,
          phone: phone,
          altPhone: data.altPhone || "",
          division: data.division || data.state || "Dhaka",
          district: data.district || data.city || "Dhaka City",
          city: data.city || data.district || "Dhaka City",
          state: data.division || data.state || "Dhaka",
          thana: data.thana || "",
          zipCode: data.zipCode || "",
          street: street,
          apartment: data.apartment || "",
          landmark: data.landmark || "",
          deliveryNotes: data.deliveryNotes || "",
          country: "Bangladesh",
          label: data.label || "Home",
          isDefault: shouldBeDefault,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await useraddressCollection.insertOne(newAddress);
        res.status(201).json({ success: true, insertedId: result.insertedId, address: { ...newAddress, _id: result.insertedId } });
      } catch (error) {
        console.error("Error saving user address:", error);
        res.status(500).send({ error: "Failed to save address" });
      }
    });

    app.put('/api/useraddress/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const data = req.body || {};
        const userEmail = (data.userEmail || data.email || "").trim();
        const userId = (data.userId || data.id || "").trim();
        const emailFilter = buildAddressFilter(userEmail, userId);

        if (data.isDefault === true && Object.keys(emailFilter).length > 0) {
          await useraddressCollection.updateMany(emailFilter, { $set: { isDefault: false } });
        }

        const updateDoc = {
          $set: {
            userEmail: userEmail,
            email: userEmail,
            userId: userId,
            fullName: data.fullName || data.name || "",
            phone: data.phone || "",
            altPhone: data.altPhone || "",
            division: data.division || data.state || "Dhaka",
            district: data.district || data.city || "Dhaka City",
            city: data.city || data.district || "Dhaka City",
            state: data.division || data.state || "Dhaka",
            thana: data.thana || "",
            zipCode: data.zipCode || "",
            street: data.street || data.address || "",
            apartment: data.apartment || "",
            landmark: data.landmark || "",
            deliveryNotes: data.deliveryNotes || "",
            country: "Bangladesh",
            label: data.label || "Home",
            isDefault: data.isDefault === true,
            updatedAt: new Date()
          }
        };

        const result = await useraddressCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);
        res.json({ success: true, modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error("Error updating user address:", error);
        res.status(500).send({ error: "Failed to update address" });
      }
    });

    app.patch('/api/useraddress/:id/default', async (req, res) => {
      try {
        const id = req.params.id;
        const { userEmail, userId } = req.body || {};
        const emailFilter = buildAddressFilter(userEmail, userId);

        if (Object.keys(emailFilter).length > 0) {
          await useraddressCollection.updateMany(emailFilter, { $set: { isDefault: false } });
        }
        const result = await useraddressCollection.updateOne({ _id: new ObjectId(id) }, { $set: { isDefault: true, updatedAt: new Date() } });
        res.json({ success: true, modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error("Error setting default address:", error);
        res.status(500).send({ error: "Failed to set default address" });
      }
    });

    app.delete('/api/useraddress/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const result = await useraddressCollection.deleteOne({ _id: new ObjectId(id) });
        res.json({ success: true, deletedCount: result.deletedCount });
      } catch (error) {
        console.error("Error deleting user address:", error);
        res.status(500).send({ error: "Failed to delete address" });
      }
    });

    // ==========================================
    // USER SHOPPING CART APIs (CRUD)
    // ==========================================

    // 1. GET user's cart items
    app.get('/api/cart', async (req, res) => {
      try {
        const email = req.query.email ? String(req.query.email).trim() : null;
        const userId = req.query.userId ? String(req.query.userId).trim() : null;

        const orConditions = [];
        if (email) {
          const escaped = escapeRegex(email);
          orConditions.push({ userEmail: { $regex: new RegExp(`^${escaped}$`, 'i') } });
          orConditions.push({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } });
        }
        if (userId) {
          orConditions.push({ userId: userId });
        }

        const filter = orConditions.length > 0 ? { $or: orConditions } : {};
        if (Object.keys(filter).length === 0) {
          return res.json([]);
        }

        const items = await cartCollection.find(filter).sort({ createdAt: -1 }).toArray();
        res.json(items);
      } catch (error) {
        console.error("Error fetching cart items:", error);
        res.status(500).json({ error: "Failed to fetch cart items" });
      }
    });

    // 2. POST add item to cart
    app.post('/api/cart', async (req, res) => {
      try {
        const data = req.body || {};
        const artworkId = data.artworkId || data.artId || data.id || data._id;
        const userEmail = (data.userEmail || data.email || "").trim();
        const userId = (data.userId || "").trim();

        if (!artworkId || (!userEmail && !userId)) {
          return res.status(400).json({ error: "Artwork ID and user info are required" });
        }

        const orConditions = [];
        if (userEmail) {
          const escaped = escapeRegex(userEmail);
          orConditions.push({ userEmail: { $regex: new RegExp(`^${escaped}$`, 'i') } });
          orConditions.push({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } });
        }
        if (userId) {
          orConditions.push({ userId: userId });
        }

        const userFilter = { $or: orConditions };
        const existingItem = await cartCollection.findOne({
          ...userFilter,
          $or: [
            { artworkId: String(artworkId) },
            { artId: String(artworkId) },
            { id: String(artworkId) }
          ]
        });

        if (existingItem) {
          const newQty = (Number(existingItem.quantity) || 1) + (Number(data.quantity) || 1);
          await cartCollection.updateOne(
            { _id: existingItem._id },
            { $set: { quantity: newQty, updatedAt: new Date() } }
          );
          return res.json({
            success: true,
            message: "Item quantity updated in cart",
            cartItem: { ...existingItem, quantity: newQty }
          });
        }

        const newCartItem = {
          artworkId: String(artworkId),
          artId: String(artworkId),
          title: data.title || "Untitled Artwork",
          price: Number(data.price) || 0,
          image: data.image || "",
          category: data.category || "Fine Art",
          dimensions: data.dimensions || "",
          companyName: data.companyName || "",
          companyId: data.companyId || "",
          artistName: data.artistName || "Unknown Artist",
          artistEmail: data.artistEmail || "",
          quantity: Number(data.quantity) || 1,
          userEmail: userEmail,
          email: userEmail,
          userId: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await cartCollection.insertOne(newCartItem);
        res.status(201).json({
          success: true,
          message: "Item added to cart successfully",
          insertedId: result.insertedId,
          cartItem: { ...newCartItem, _id: result.insertedId }
        });
      } catch (error) {
        console.error("Error adding item to cart:", error);
        res.status(500).json({ error: "Failed to add item to cart" });
      }
    });

    // 3. PUT update item quantity
    app.put('/api/cart/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const { quantity } = req.body || {};
        const parsedQty = Math.max(1, Number(quantity) || 1);

        let filter = { _id: id };
        if (ObjectId.isValid(id)) {
          filter = { $or: [{ _id: id }, { _id: new ObjectId(id) }] };
        }

        const result = await cartCollection.updateOne(filter, {
          $set: { quantity: parsedQty, updatedAt: new Date() }
        });

        res.json({ success: true, modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.status(500).json({ error: "Failed to update cart item" });
      }
    });

    // 4. DELETE remove single item from cart
    app.delete('/api/cart/:id', async (req, res) => {
      try {
        const id = req.params.id;
        let query = { _id: id };
        if (ObjectId.isValid(id)) {
          query = { $or: [{ _id: id }, { _id: new ObjectId(id) }] };
        }

        const result = await cartCollection.deleteOne(query);
        res.json({ success: true, deletedCount: result.deletedCount });
      } catch (error) {
        console.error("Error removing cart item:", error);
        res.status(500).json({ error: "Failed to delete item from cart" });
      }
    });

    // 5. DELETE clear entire cart for user
    app.delete('/api/cart/clear/all', async (req, res) => {
      try {
        const email = req.query.email ? String(req.query.email).trim() : null;
        const userId = req.query.userId ? String(req.query.userId).trim() : null;

        const orConditions = [];
        if (email) {
          const escaped = escapeRegex(email);
          orConditions.push({ userEmail: { $regex: new RegExp(`^${escaped}$`, 'i') } });
          orConditions.push({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } });
        }
        if (userId) {
          orConditions.push({ userId: userId });
        }

        const filter = orConditions.length > 0 ? { $or: orConditions } : {};
        if (Object.keys(filter).length === 0) {
          return res.status(400).json({ error: "User email or ID required to clear cart" });
        }

        const result = await cartCollection.deleteMany(filter);
        res.json({ success: true, deletedCount: result.deletedCount });
      } catch (error) {
        console.error("Error clearing user cart:", error);
        res.status(500).json({ error: "Failed to clear cart" });
      }
    });


    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please terminate the process using port ${port} or change the port.`);
  } else {
    console.error('Server error:', err);
  }
});