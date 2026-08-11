import express, { Request, Response } from 'express';
import multer from 'multer';
import { supabase } from '../supabaseClient';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * UPLOAD PROOF OF DELIVERY (POD)
 * Receives the image file from the mobile app, uploads it to Supabase Storage, 
 * and automatically marks the Dispatch Order as Completed.
 */
router.post('/api/dispatch/:id/pod', upload.single('podImage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    // 1. Define a unique file path inside your 'pod-storage' bucket
    const fileName = `pod_${id}_${Date.now()}.${file.mimetype.split('/')[1]}`;

    // 2. Upload the file buffer to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('pod-storage')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // 3. Get the Public URL of the uploaded image
    const { data: publicUrlData } = supabase.storage
      .from('pod-storage')
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;

    // 4. Update the DispatchOrder table to mark it as Completed
    const { data: updatedDispatch, error: dbError } = await supabase
      .from('DispatchOrder')
      .update({ status: 'Completed' })
      .eq('dispatchID', id)
      .select()
      .single();

    if (dbError) throw dbError;

    res.status(200).json({
      message: 'Proof of Delivery uploaded successfully!',
      imageUrl,
      data: updatedDispatch,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;