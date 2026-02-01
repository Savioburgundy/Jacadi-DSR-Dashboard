import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getCollection } from '../config/mongodb';
import { authenticateJWT, authorizeRole } from '../middleware/auth.middleware';

const router = Router();

// Apply Authentication & Authorization (Admin Only)
router.use(authenticateJWT);
router.use(authorizeRole(['admin']));

// GET /api/users - List all users
router.get('/', async (req, res) => {
    try {
        const users = getCollection('users');
        const result = await users.find(
            {},
            { projection: { password_hash: 0 } }
        ).sort({ created_at: -1 }).limit(100).toArray();
        
        // Transform _id to id for frontend compatibility
        const transformed = result.map((u: any) => ({
            id: u._id.toString(),
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            active: u.active,
            created_at: u.created_at
        }));
        
        res.json(transformed);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
    const { email, password, full_name, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const users = getCollection('users');
        
        // Check if user exists
        const existing = await users.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date();

        const result = await users.insertOne({
            email,
            password_hash: hashedPassword,
            full_name,
            role,
            active: 1,
            created_at: now,
            updated_at: now
        } as any);

        res.status(201).json({ 
            message: 'User created successfully', 
            user: { id: result.insertedId.toString(), email, role } 
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const users = getCollection('users');
        await users.deleteOne({ _id: new ObjectId(id) });
        res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

export default router;
