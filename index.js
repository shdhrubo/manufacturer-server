const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


const app = express();
const port = process.env.PORT || 5000;

app.use(cors()); //middleware
app.use(express.json()); //middleware for undefined
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vcmdl33.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const userCollection = client.db("manufacturer").collection("user");
    const servicesCollection = client.db("manufacturer").collection("services");
    const ordersCollection = client.db("manufacturer").collection("orders");
    const reviewsCollection = client.db("manufacturer").collection("reviews");
    const paymentCollection = client.db("manufacturer").collection("payment");
    const whyUsCollection = client.db("manufacturer").collection("whyus");
//verify admin 
 //verify admin
 const verifyAdmin = async (req, res, next) => {
  const requester = req.decoded.email;
  const requesterAccount = await userCollection.findOne({
    email: requester,
  });
  if (requesterAccount.role === "admin") {
    next();
  } else {
    res.status(403).send({ message: "forbidden" });
  }
};
    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = servicesCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });
    app.get("/whyus", async (req, res) => {
      const query = {};
      const cursor = whyUsCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });
    //get one service
    app.get("/service/:id",verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const service = await servicesCollection.findOne(query);
      res.send(service);
    });

    //post orders
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });
    //get orders by email
    app.get("/order/:email",verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { user: email };
      const order = await ordersCollection.find(query).toArray();
      res.send(order);
    });

    //user
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );
      res.send({ result, token });
    });
    //get one user
    app.get("/user/:email",verifyJWT,verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send(user);
    });
    //get all users
    app.get("/user",verifyJWT,verifyAdmin, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    //add a service
    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await servicesCollection.insertOne(product);
      res.send(result);
    });
    //delete a service
    app.delete("/service/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await servicesCollection.deleteOne(filter);
      res.send(result);
    });
    //order delete api
    app.delete("/order/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await ordersCollection.deleteOne(filter);
      res.send(result);
    });
    //admin check
    app.get("/admin/:email",verifyJWT,verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    //admin making
    app.put("/user/admin/:email", async (req, res) => {
      const email = req.params.email;

      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //reviews post
    app.post("/reviews", async (req, res) => {
      const reviews = req.body;
      const result = await reviewsCollection.insertOne(reviews);
      res.send(result);
    });
    //   reviews get
    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = reviewsCollection.find(query);
      const reviews = await cursor.toArray();
      res.send(reviews);
    });
    //payment
    app.get("/orders/:id",verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const service = await ordersCollection.findOne(query);
      res.send(service);
    });
    //get payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const service = req.body;
      const cost = service.cost;
      console.log(cost);
      const amount = cost * 100;
      console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    //updating booking informaton like transaction id or paid
    app.patch("/order/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };

      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await ordersCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(updatedBooking);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(" Manufacturing website running");
});
app.listen(port, () => {
  console.log("listening to port", port);
});
