const express = require('express');
const router = express.Router();

const predictionController = require('../controllers/predictionController');
const { protect } = require('../middleware/authMiddleware');
const { validate, predictionSchema } = require('../utils/validators');

router.post('/', protect, validate(predictionSchema), predictionController.submitPrediction);

module.exports = router;
