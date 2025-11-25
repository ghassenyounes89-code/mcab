import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

// Cloudinary Configuration
console.log('🔍 Checking Cloudinary configuration...');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '***' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'NOT SET');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '***' + process.env.CLOUDINARY_API_SECRET.slice(-4) : 'NOT SET');

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary configured successfully');
} else {
  console.log('❌ Cloudinary configuration incomplete');
}

// Enhanced CORS configuration
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://localhost:3000","https://mcashop.netlify.app/"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.static("public"));

// Enhanced error handling for file uploads
const uploadsDir = 'public/uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.log("❌ MongoDB Error:", err);
    process.exit(1);
  });

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 50 * 1024 * 1024,
    files: 10
  }
});

// Mongoose Schemas
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: { type: String, required: true },
  colors: [String],
  sizes: [String],
  photos: [String],
  createdAt: { type: Date, default: Date.now },
});
const Product = mongoose.model("Product", ProductSchema);

const OrderSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  productPrice: { type: Number, required: true },
  productPhotos: [String],
  clientName: { type: String, required: true },
  wilaya: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  color: String,
  size: String,
  quantity: { type: Number, default: 1 },
  status: { type: String, default: "pending" },
  orderDate: { type: Date, default: Date.now },
  ipAddress: String,
  userAgent: String,
  isVerified: { type: Boolean, default: false }
});
const Order = mongoose.model("Order", OrderSchema);

const DashboardStatsSchema = new mongoose.Schema({
  totalRevenue: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalCustomers: { type: Number, default: 0 },
  pendingOrders: { type: Number, default: 0 },
  totalProducts: { type: Number, default: 0 },
  monthlyRevenue: [{
    month: String,
    revenue: Number
  }],
  updatedAt: { type: Date, default: Date.now }
});
const DashboardStats = mongoose.model("DashboardStats", DashboardStatsSchema);

const HeroContentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  buttonText: { type: String, default: "Shop Now" },
  theme: { type: String, default: "light" },
  order: { type: Number, default: 0 },
  mediaType: { type: String, enum: ["video", "image"], required: true },
  mediaUrl: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const HeroContent = mongoose.model("HeroContent", HeroContentSchema);

// Cloudinary Functions
const uploadToCloudinary = async (filePath, resourceType = 'auto') => {
  try {
    console.log("📤 Uploading to Cloudinary:", filePath);
    
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      throw new Error('Cloudinary not configured');
    }

    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: resourceType,
      folder: 'mca_shop',
      quality: 'auto',
      fetch_format: 'auto'
    });
    
    console.log("✅ Cloudinary upload successful:", result.secure_url);
    return result.secure_url;
    
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error.message);
    throw error;
  }
};

const deleteFromCloudinary = async (url) => {
  try {
    const parts = url.split('/');
    const filenameWithExtension = parts[parts.length - 1];
    const publicId = 'mca_shop/' + filenameWithExtension.split('.')[0];
    
    await cloudinary.uploader.destroy(publicId);
    console.log("✅ Deleted from Cloudinary:", publicId);
  } catch (error) {
    console.error('❌ Error deleting from Cloudinary:', error.message);
  }
};

// Dashboard Functions
const initializeDashboardStats = async () => {
  try {
    const stats = await DashboardStats.findOne();
    if (!stats) {
      const initialStats = new DashboardStats({
        totalRevenue: 1250,
        totalOrders: 0,
        totalCustomers: 0,
        pendingOrders: 0,
        totalProducts: 0,
        monthlyRevenue: [
          { month: 'Jan', revenue: 1200 },
          { month: 'Feb', revenue: 1800 },
          { month: 'Mar', revenue: 1500 },
          { month: 'Apr', revenue: 2000 },
          { month: 'May', revenue: 1700 },
          { month: 'Jun', revenue: 2200 }
        ]
      });
      await initialStats.save();
      console.log('✅ Initialized dashboard stats');
    }
  } catch (error) {
    console.error('Error initializing dashboard stats:', error);
  }
};

const updateDashboardStats = async () => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const totalProducts = await Product.countDocuments();
    
    const deliveredOrders = await Order.find({ status: 'delivered' });
    const totalRevenue = deliveredOrders.reduce((sum, order) => 
      sum + (order.productPrice * order.quantity), 0
    );
    
    const uniqueCustomers = await Order.distinct('email');
    
    await DashboardStats.findOneAndUpdate({}, {
      totalRevenue,
      totalOrders,
      totalCustomers: uniqueCustomers.length,
      pendingOrders,
      totalProducts,
      updatedAt: new Date()
    }, { upsert: true });
    
  } catch (error) {
    console.error('Error updating dashboard stats:', error);
  }
};

// ==================== ROUTES ====================

// Health check
app.get("/", (req, res) => {
  res.json({ 
    message: "✅ MCA Shop API Running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? "Configured" : "Not Configured"
  });
});

// Test Cloudinary connection
app.get("/api/test-cloudinary", async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({
        success: false,
        message: "Cloudinary not configured - check your .env file"
      });
    }

    console.log("🧪 Testing Cloudinary connection...");
    
    // Test the configuration first
    try {
      const pingResult = await cloudinary.api.ping();
      console.log("✅ Cloudinary ping successful:", pingResult);
    } catch (pingError) {
      console.log("❌ Cloudinary ping failed:", pingError.message);
      return res.status(500).json({
        success: false,
        message: "Cloudinary authentication failed: " + pingError.message
      });
    }

    // Create a simple test image
    const testImagePath = path.join(__dirname, 'public', 'test-image.png');
    const testImageDir = path.dirname(testImagePath);
    
    if (!fs.existsSync(testImageDir)) {
      fs.mkdirSync(testImageDir, { recursive: true });
    }
    
    // 1x1 transparent PNG
    const transparentPNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    fs.writeFileSync(testImagePath, Buffer.from(transparentPNG, 'base64'));

    const result = await uploadToCloudinary(testImagePath, 'image');
    
    // Clean up test file
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    
    console.log("✅ Cloudinary test successful!");
    res.json({ 
      success: true, 
      message: "Cloudinary is working perfectly!",
      imageUrl: result
    });
  } catch (error) {
    console.error("❌ Cloudinary test failed:", error);
    res.status(500).json({ 
      success: false, 
      message: "Cloudinary error: " + error.message
    });
  }
});

// ==================== PRODUCT ROUTES ====================

// Get all products
app.get("/api/public/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("❌ Error fetching products:", err);
    res.status(500).json({ message: "Error fetching products: " + err.message });
  }
});

// Get single product
app.get("/api/public/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create product
app.post("/api/admin/products", upload.array("photos", 10), async (req, res) => {
  try {
    const { name, description, price, category, colors, sizes } = req.body;

    if (!name || !name.trim() || !price || isNaN(price) || !category || !category.trim() || !req.files || req.files.length === 0) {
      return res.status(400).json({ message: "All fields including photos are required" });
    }

    const photoUrls = [];
    
    for (const file of req.files) {
      try {
        const imageUrl = await uploadToCloudinary(file.path, 'image');
        photoUrls.push(imageUrl);
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (uploadError) {
        console.error("❌ Cloudinary upload error:", uploadError);
        photoUrls.push(`/uploads/${file.filename}`);
      }
    }

    const colorsArray = colors ? colors.split(',').map(color => color.trim()).filter(color => color !== '') : [];
    const sizesArray = sizes ? sizes.split(',').map(size => size.trim()).filter(size => size !== '') : [];

    const newProduct = new Product({ 
      name: name.trim(), 
      description: description ? description.trim() : "", 
      price: parseFloat(price),
      category: category.trim(),
      colors: colorsArray,
      sizes: sizesArray,
      photos: photoUrls
    });

    await newProduct.save();
    await updateDashboardStats();
    
    res.status(201).json(newProduct);
  } catch (err) {
    console.error("❌ Error creating product:", err);
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(500).json({ message: "Error creating product: " + err.message });
  }
});

// Update product
app.put("/api/admin/products/:id", upload.array("photos", 10), async (req, res) => {
  try {
    const { name, description, price, category, colors, sizes } = req.body;
    
    const updateData = {
      name,
      description,
      price,
      category,
      colors: colors ? colors.split(',').map(color => color.trim()) : [],
      sizes: sizes ? sizes.split(',').map(size => size.trim()) : []
    };

    if (req.files && req.files.length > 0) {
      const photoUrls = [];
      for (const file of req.files) {
        try {
          const imageUrl = await uploadToCloudinary(file.path, 'image');
          photoUrls.push(imageUrl);
          fs.unlinkSync(file.path);
        } catch (uploadError) {
          console.error("Cloudinary upload error:", uploadError);
          photoUrls.push(`/uploads/${file.filename}`);
        }
      }
      updateData.photos = photoUrls;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete product
app.delete("/api/admin/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.photos && product.photos.length > 0) {
      for (const photoUrl of product.photos) {
        if (photoUrl.includes('cloudinary.com')) {
          await deleteFromCloudinary(photoUrl);
        } else if (photoUrl.startsWith('/uploads/')) {
          const filePath = path.join(__dirname, 'public', photoUrl);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    await updateDashboardStats();
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==================== HERO CONTENT ROUTES ====================

// Get all hero content (for public website)
app.get("/api/public/hero-content", async (req, res) => {
  try {
    const heroContents = await HeroContent.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json(heroContents);
  } catch (err) {
    console.error("❌ Error fetching hero content:", err);
    res.status(500).json({ message: "Error fetching hero content" });
  }
});

// Get all hero content (for admin panel)
app.get("/api/admin/hero-content", async (req, res) => {
  try {
    const heroContents = await HeroContent.find().sort({ order: 1, createdAt: -1 });
    console.log(`📋 Fetched ${heroContents.length} hero content items for admin`);
    res.json(heroContents);
  } catch (err) {
    console.error("❌ Error fetching hero content for admin:", err);
    res.status(500).json({ message: "Error fetching hero content: " + err.message });
  }
});

// Get single hero content
app.get("/api/admin/hero-content/:id", async (req, res) => {
  try {
    const heroContent = await HeroContent.findById(req.params.id);
    if (!heroContent) {
      return res.status(404).json({ message: "Hero content not found" });
    }
    res.json(heroContent);
  } catch (err) {
    console.error("❌ Error fetching hero content:", err);
    res.status(500).json({ message: "Error fetching hero content: " + err.message });
  }
});

// Create hero content
app.post("/api/admin/hero-content", upload.single("media"), async (req, res) => {
  try {
    const { title, subtitle, buttonText, theme, order, isActive, mediaType } = req.body;

    if (!title || !title.trim() || !subtitle || !subtitle.trim() || !req.file) {
      return res.status(400).json({ message: "Title, subtitle and media file are required" });
    }

    let finalMediaType = mediaType;
    if (!finalMediaType) {
      if (req.file.mimetype.startsWith('video/')) {
        finalMediaType = 'video';
      } else if (req.file.mimetype.startsWith('image/')) {
        finalMediaType = 'image';
      } else {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Invalid file type" });
      }
    }

    let mediaUrl;
    const tempFilePath = req.file.path;

    try {
      const resourceType = finalMediaType === 'video' ? 'video' : 'image';
      mediaUrl = await uploadToCloudinary(tempFilePath, resourceType);
      
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (uploadError) {
      console.error("❌ Cloudinary upload error, using local storage:", uploadError);
      mediaUrl = `/uploads/${req.file.filename}`;
    }

    const newHeroContent = new HeroContent({
      title: title.trim(),
      subtitle: subtitle.trim(),
      buttonText: buttonText || "Shop Now",
      theme: theme || "light",
      order: parseInt(order) || 0,
      mediaType: finalMediaType,
      mediaUrl,
      isActive: isActive !== 'false'
    });

    await newHeroContent.save();
    res.status(201).json(newHeroContent);

  } catch (err) {
    console.error("❌ Error creating hero content:", err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: "Error creating hero content: " + err.message });
  }
});

// Update hero content
app.put("/api/admin/hero-content/:id", upload.single("media"), async (req, res) => {
  try {
    const { title, subtitle, buttonText, theme, order, isActive, mediaType } = req.body;

    const heroContent = await HeroContent.findById(req.params.id);
    if (!heroContent) {
      return res.status(404).json({ message: "Hero content not found" });
    }

    const updateData = {
      title: title ? title.trim() : heroContent.title,
      subtitle: subtitle ? subtitle.trim() : heroContent.subtitle,
      buttonText: buttonText || heroContent.buttonText,
      theme: theme || heroContent.theme,
      order: order ? parseInt(order) : heroContent.order,
      isActive: isActive !== undefined ? isActive !== 'false' : heroContent.isActive,
      updatedAt: new Date()
    };

    // Handle media update if new file is provided
    if (req.file) {
      let finalMediaType = mediaType;
      if (!finalMediaType) {
        if (req.file.mimetype.startsWith('video/')) {
          finalMediaType = 'video';
        } else if (req.file.mimetype.startsWith('image/')) {
          finalMediaType = 'image';
        } else {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "Invalid file type" });
        }
      }

      let mediaUrl;
      const tempFilePath = req.file.path;

      try {
        const resourceType = finalMediaType === 'video' ? 'video' : 'image';
        mediaUrl = await uploadToCloudinary(tempFilePath, resourceType);
        
        // Delete old media from Cloudinary if it exists
        if (heroContent.mediaUrl && heroContent.mediaUrl.includes('cloudinary.com')) {
          await deleteFromCloudinary(heroContent.mediaUrl);
        }
        
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (uploadError) {
        console.error("❌ Cloudinary upload error, using local storage:", uploadError);
        mediaUrl = `/uploads/${req.file.filename}`;
      }

      updateData.mediaType = finalMediaType;
      updateData.mediaUrl = mediaUrl;
    } else if (mediaType) {
      // Update media type without changing the file
      updateData.mediaType = mediaType;
    }

    const updatedHeroContent = await HeroContent.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    console.log("✅ Hero content updated:", updatedHeroContent._id);
    res.json(updatedHeroContent);

  } catch (err) {
    console.error("❌ Error updating hero content:", err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: "Error updating hero content: " + err.message });
  }
});

// Delete hero content
app.delete("/api/admin/hero-content/:id", async (req, res) => {
  try {
    const heroContent = await HeroContent.findById(req.params.id);
    if (!heroContent) {
      return res.status(404).json({ message: "Hero content not found" });
    }

    // Delete media from Cloudinary if it exists
    if (heroContent.mediaUrl && heroContent.mediaUrl.includes('cloudinary.com')) {
      await deleteFromCloudinary(heroContent.mediaUrl);
    } else if (heroContent.mediaUrl && heroContent.mediaUrl.startsWith('/uploads/')) {
      // Delete local file
      const filePath = path.join(__dirname, 'public', heroContent.mediaUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await HeroContent.findByIdAndDelete(req.params.id);
    console.log("🗑️ Hero content deleted:", req.params.id);
    
    res.json({ message: "Hero content deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting hero content:", err);
    res.status(500).json({ message: "Error deleting hero content: " + err.message });
  }
});

// ==================== ORDER ROUTES ====================

// Create order
app.post("/api/public/orders", async (req, res) => {
  try {
    const {
      productId,
      productName,
      productPrice,
      productPhotos,
      clientName,
      wilaya,
      address,
      phone,
      email,
      color,
      size,
      quantity = 1
    } = req.body;

    if (!productId || !productName || !productPrice || !clientName || !wilaya || !address || !phone || !email) {
      return res.status(400).json({ message: "All required fields must be filled" });
    }

    const phoneRegex = /^(05|06|07)[0-9]{8}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const duplicateOrder = await Order.findOne({
      productId,
      phone,
      email,
      orderDate: { $gte: oneHourAgo }
    });

    if (duplicateOrder) {
      return res.status(400).json({ message: "You have already ordered this product recently" });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const recentOrdersFromIP = await Order.countDocuments({
      ipAddress,
      orderDate: { $gte: oneHourAgo }
    });

    if (recentOrdersFromIP > 5) {
      return res.status(400).json({ message: "Too many orders from this location" });
    }

    const order = new Order({
      productId,
      productName,
      productPrice,
      productPhotos,
      clientName,
      wilaya,
      address,
      phone,
      email,
      color,
      size,
      quantity,
      ipAddress,
      userAgent,
      isVerified: recentOrdersFromIP < 2
    });
    
    await order.save();
    await updateDashboardStats();
    
    console.log(`📦 New order received: ${productName} by ${clientName}`);
    
    res.status(201).json({ 
      success: true,
      message: "Order placed successfully! We will contact you soon.",
      orderId: order._id
    });
  } catch (err) {
    console.error("❌ Order error:", err);
    res.status(500).json({ message: "There was an error placing your order. Please try again." });
  }
});

// Get all orders (admin)
app.get("/api/admin/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderDate: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update order status
app.put("/api/admin/orders/:id", async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    await updateDashboardStats();
    res.json(updatedOrder);
  } catch (err) {
    console.error("❌ Error updating order status:", err);
    res.status(500).json({ message: "Error updating order status: " + err.message });
  }
});

// Delete order
app.delete("/api/admin/orders/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    await updateDashboardStats();
    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting order:", err);
    res.status(500).json({ message: "Error deleting order: " + err.message });
  }
});

// ==================== DASHBOARD ROUTES ====================

// Dashboard stats
app.get("/api/admin/dashboard/stats", async (req, res) => {
  try {
    let stats = await DashboardStats.findOne();
    
    if (!stats) {
      await initializeDashboardStats();
      stats = await DashboardStats.findOne();
    }

    const dashboardData = {
      totalRevenue: stats.totalRevenue,
      revenueChange: -12.5,
      newCustomers: stats.totalCustomers,
      customersChange: -20,
      activeAccounts: stats.totalCustomers * 37,
      accountsChange: -12.5,
      growthRate: 4.5,
      growthChange: -4.5,
      pendingOrders: stats.pendingOrders,
      totalProducts: stats.totalProducts,
      totalOrders: stats.totalOrders,
      monthlyRevenue: stats.monthlyRevenue
    };

    res.json(dashboardData);
  } catch (err) {
    console.error("❌ Dashboard stats error:", err);
    res.status(500).json({ message: "Error fetching dashboard statistics" });
  }
});

// ==================== UTILITY ROUTES ====================

// Algerian wilayas
app.get("/api/wilayas", (req, res) => {
  const wilayas = [
    "Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra", "Béchar", "Blida", "Bouira",
    "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret", "Tizi Ouzou", "Algiers", "Djelfa", "Jijel", "Sétif", "Saïda",
    "Skikda", "Sidi Bel Abbès", "Annaba", "Guelma", "Constantine", "Médéa", "Mostaganem", "M'Sila", "Mascara", "Ouargla",
    "Oran", "El Bayadh", "Illizi", "Bordj Bou Arréridj", "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt", "El Oued", "Khenchela",
    "Souk Ahras", "Tipaza", "Mila", "Aïn Defla", "Naâma", "Aïn Témouchent", "Ghardaïa", "Relizane", "Timimoun", "Bordj Badji Mokhtar",
    "Ouled Djellal", "Béni Abbès", "In Salah", "In Guezzam", "Touggourt", "Djanet", "El M'Ghair", "El Menia"
  ];
  res.json(wilayas);
});

// ==================== ERROR HANDLING ====================

// Error handling
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.message);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 50MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Too many files. Maximum is 10 files.' });
    }
  }
  
  res.status(500).json({ 
    message: "Something went wrong!",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    message: "Route not found",
    path: req.path,
    method: req.method
  });
});

// Initialize dashboard stats
initializeDashboardStats().then(() => {
  console.log("📊 Dashboard stats initialized");
});

// Start server
const PORT = process.env.PORT || 5410;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 MCA Shop Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`☁️ Test Cloudinary: http://localhost:${PORT}/api/test-cloudinary`);
  console.log(`📋 Hero Content Admin: http://localhost:${PORT}/api/admin/hero-content`);
});