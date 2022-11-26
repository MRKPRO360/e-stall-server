const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

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
    const reportedCollection = client.db("eStall").collection("reported");
    const paymentsCollection = client.db("eStall").collection("payments");

    // creating jwt token

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "90d",
      });
      res.send({ token });
    });

    // verifying buyer by jwt
    const verifyBuyer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };

      const user = await usersCollection.findOne(query);

      if (user?.role !== "buyer")
        return res.status(403).send({ message: "Forbidden access" });

      next();
    };

    // verifying seller by jwt
    const verifySeller = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email: email };

      const user = await usersCollection.findOne(query);

      if (user?.role !== "seller")
        return res.status(403).send({ message: "Forbidden access" });

      next();
    };

    // verifying admin by jwt
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };

      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin")
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

    // get all sellers for admin
    app.get(
      "/users/sellersForAdmin",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const query = { role: "seller" };

        const users = await usersCollection.find(query).toArray();
        res.send(users);
      }
    );

    // get all sellers for admin
    app.get(
      "/users/buyersForAdmin",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const query = { role: "buyer" };

        const users = await usersCollection.find(query).toArray();
        res.send(users);
      }
    );

    // update(verify) a seller
    //NOTE: not working for categories
    app.patch(
      "/users/sellersForAdmin/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const email = req.query.email;

        const filter = { _id: ObjectId(id) };
        const query = { sellerEmail: email };

        console.log(query);

        const updatedDoc = {
          $set: {
            verified: true,
          },
        };

        // as well as update the categories data
        await categoriesCollection.updateOne(query, updatedDoc);

        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // delete a seller
    app.delete(
      "/users/sellersForAdmin/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };

        const result = await usersCollection.deleteOne(filter);
        res.send(result);
      }
    );

    // delete a buyer
    app.delete(
      "/users/buyersForAdmin/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };

        const result = await usersCollection.deleteOne(filter);
        res.send(result);
      }
    );

    // get all bookings for specific user
    app.get("/bookings", verifyJWT, verifyBuyer, async (req, res) => {
      const query = { email: req.decoded.email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    // get individual bookings for specific user
    app.get("/bookings/:id", verifyJWT, verifyBuyer, async (req, res) => {
      const id = req.params.id;

      const query = { _id: ObjectId(id) };
      const booking = await bookingsCollection.findOne(query);
      res.send(booking);
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

    // delete a booking

    app.delete("/bookings/:id", verifyJWT, verifyBuyer, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await bookingsCollection.deleteOne(filter);
      res.send(result);
    });

    // get all products for specific seller

    app.get("/products", verifyJWT, verifySeller, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query = { sellerEmail: decodedEmail };

      const products = await productsCollection.find(query).toArray();

      res.send(products);
    });

    // get all advertised products

    app.get("/advertisedProducts", async (req, res) => {
      const query = { advertised: true, sold: false };

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

    // update(advertised) a product
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

    // stripe payment-intent
    app.post(
      "/create-payment-intent",
      verifyJWT,
      verifyBuyer,
      async (req, res) => {
        const book = req.body;
        const price = book.price;
        if (!price) return;
        const amount = price * 100;

        const paymentIntent = await stripe.paymentIntents.create({
          currency: "usd",
          amount: amount,
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      }
    );

    // add reported product
    app.post("/reportedProducts", verifyJWT, verifyBuyer, async (req, res) => {
      const product = req.body;
      const result = await reportedCollection.insertOne(product);
      res.send(result);
    });

    // get reported product for admin
    app.get("/reportedProducts", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const products = await reportedCollection.find(query).toArray();
      res.send(products);
    });

    // delete reported product
    app.delete(
      "/reportedProducts/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const productId = req.query.productId;
        const query = { _id: ObjectId(productId) };

        const filter = { _id: ObjectId(id) };
        const products = await reportedCollection.deleteOne(filter);

        // remove it from categories
        await categoriesCollection.deleteOne(query);
        res.send(products);
      }
    );
    // creating payment
    app.post("/payments", verifyJWT, verifyBuyer, async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);

      const id = payment.bookingId;
      const categoryProductId = payment.productId;

      const filter = { _id: ObjectId(id) };

      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };

      //updating booking
      await bookingsCollection.updateOne(filter, updatedDoc);

      // updating products(advertised)
      const updatedDocForProducts = {
        $set: {
          advertised: false,
          sold: true,
        },
      };
      const search = { _id: ObjectId(categoryProductId) };
      await productsCollection.updateOne(search, updatedDocForProducts);

      //deleting from categories collection
      const query = { _id: ObjectId(categoryProductId) };
      await categoriesCollection.deleteOne(query);

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
