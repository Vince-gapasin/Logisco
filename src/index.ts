import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

// 1. Import your Routes
import authController from './controllers/authController';
import employeeController from './controllers/employeeController';
import bookingRoutes from './routes/bookingRoutes';
import staffRoutes from './routes/staffRoutes';
import dispatchRoutes from './routes/dispatchRoutes';
import clientController from './controllers/clientController';
import partnerController from './controllers/partnerController';
import maintenanceRoutes from './routes/maintenanceRoutes';
import subcontractorRoutes from './routes/subcontractorRoutes';
import podRoutes from './routes/podRoutes';
import orderController from './controllers/orderController';

// 👇 THIS IS THE ONLY TRUCK FILE NOW
import truckController from './controllers/truckController'; 

// 2. Import your Background Worker
import { startDwellTimeMonitor } from './workers/dwellTimeMonitor';

dotenv.config();

// 3. Initialize the Express 'app'
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configure Multer for processing incoming file uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

// 4. Connect your Routes to the app
app.use(bookingRoutes);
app.use(staffRoutes);
app.use(dispatchRoutes);
// ❌ (Deleted app.use(truckRoutes) from here!)
app.use(maintenanceRoutes);
app.use(subcontractorRoutes);
app.use(podRoutes);

app.use('/api/auth', authController);
app.use('/api/employees', employeeController);

// 👇 Express will now ONLY use our perfect code!
app.use('/api/trucks', truckController);
app.use('/api/clients', clientController);
app.use('/api/partners', partnerController);
app.use('/api/orders', orderController);

// (Legacy Endpoint) Proof of Delivery Upload
app.post('/api/upload-pod', upload.single('podImage'), async (req: Request, res: Response) => {
  res.status(200).json({ message: "POD endpoint ready" });
});

// 5. Start Background Workers
startDwellTimeMonitor();

// 6. Start the Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend for Frontend running on http://localhost:${PORT}`);
});