const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 5000;

const app = express();

app.use(express.json());
app.use(cors());

// veryfying jwt token middleware
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

const run = async function () {
  try {
    const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster2.lcqlurn.mongodb.net/?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: ServerApiVersion.v1,
    });

    const categoriesCollection = client.db("eStall").collection("categories");
    const usersCollection = client.db("eStall").collection("user");
    const bookingsCollection = client.db("eStall").collection("bookings");
    const productsCollection = client.db("eStall").collection("products");

    // creating jwt token

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "90d",
      });
      res.send({ token });
    });

    // verifying seller by jwt
    const verifySeller = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };

      const user = await usersCollection.findOne(query);

      if (user?.role !== "seller")
        return res.status(403).send({ message: "Forbidden access" });

      next();
    };

    // get category by id
    app.get("/categories/:id", async (req, res) => {
      const id = req.params.id;

      const query = { id: id, sold: false };
      const categories = await categoriesCollection.find(query).toArray();
      res.send(categories);
    });

    // create a new user with role(buyer, seller, admin)
    app.post("/users", async (req, res) => {
      const doc = req.body;

      const query = {
        name: req.body.name,
        email: req.body.email,
      };
      const alreadyLoggedIn = await usersCollection.findOne(query);

      if (alreadyLoggedIn)
        return res.send({ message: "User already logged in!" });

      const result = await usersCollection.insertOne(doc);
      res.send(result);
    });

    // check buyer
    app.get("/users/buyer", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };

      const user = await usersCollection.findOne(query);
      res.send({ isBuyer: user?.role === "buyer" });
    });

    // check seller
    app.get("/users/seller", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };

      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.role === "seller" });
    });

    // check admin
    app.get("/users/admin", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };

      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    // create a booking
    app.post("/bookings", verifyJWT, async (req, res) => {
      const booking = req.body;
      const decoded = req.decoded;

      if (decoded.email !== req.body.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    // get all products for specific seller

    app.get("/products", verifyJWT, verifySeller, async (req, res) => {
      const decodedEmail = req.decodedEmail;
      const query = { email: decodedEmail };

      const products = await productsCollection.find(query).toArray();

      res.send(products);
    });

    // get all advertised products
    app.get("/advertisedProducts", async (req, res) => {
      const query = { advertised: true };

      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });

    // create a product
    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      // push this item into category collection
      await categoriesCollection.insertOne(product);
      res.send(result);
    });

    // update a product
    app.patch("/products/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };

      const updatedDoc = {
        $set: {
          advertised: true,
        },
      };

      const result = await productsCollection.updateOne(query, updatedDoc);

      res.send(result);
    });

    // delete a product
    app.delete("/products/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };

      const result = await productsCollection.deleteOne(query);

      res.send(result);
    });
  } finally {
  }
};

run().catch((err) => console.error(err));

app.get("/", (req, res) => {
  res.send("Hello from the server!");
});

app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
