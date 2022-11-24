const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 5000;

const app = express();

app.use(express.json());
app.use(cors());

const run = async function () {
  try {
    const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster2.lcqlurn.mongodb.net/?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: ServerApiVersion.v1,
    });

    const categoriesCollection = client.db("eStall").collection("categories");

    app.get("/categories/:id", async (req, res) => {
      const id = req.params.id;

      const query = { id: id };
      const categories = await categoriesCollection.find(query).toArray();
      res.send(categories);
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