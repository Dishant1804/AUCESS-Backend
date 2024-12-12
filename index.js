import express from "express";
import authRoutes from './api/v1/authroutes.js'
import quizRoutes from './api/v1/quizroutes.js'
import paymentRoutes from './api/v1/payymentroutes.js'
import adminRoutes from './api/v1/adminRoutes.js'

const app = express();

app.use(express.json());
app.use("/api/v1/auth" , authRoutes);
app.use("/api/v1/admin" , adminRoutes);
app.use("/api/v1/quiz", quizRoutes);
app.use("/api/v1/payment", paymentRoutes);


app.listen(3000, () => {
  console.log("Server started");
})