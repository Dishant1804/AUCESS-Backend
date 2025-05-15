import express from "express";
import authRoutes from './api/v1/authroutes.js'
import quizRoutes from './api/v1/quizroutes.js'
import paymentRoutes from './api/v1/payymentroutes.js'
import adminRoutes from './api/v1/adminRoutes.js'
import userRoutes from './api/v1/userRoutes.js'
import passport from "./api/v1/config/passportConfig.js";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

const app = express();

const corsOptions = {
  origin: ["http://localhost:3001", "*"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(cors(corsOptions));
app.use(passport.initialize());
app.use("/api/v1/auth" , authRoutes);
app.use("/api/v1/admin" , adminRoutes);
app.use("/api/v1/quiz", quizRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/users", userRoutes);


app.listen(3000, () => {
  console.log("Server started");
})