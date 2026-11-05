import { Router } from 'express';
import { getShop, listShops } from '../controllers/shopController.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { shopListQuery } from '../validators/shop.validators.js';

const r = Router();
r.get('/', validate(shopListQuery, 'query'), listShops);
r.get('/:id', validateObjectId('id'), getShop);
export default r;
