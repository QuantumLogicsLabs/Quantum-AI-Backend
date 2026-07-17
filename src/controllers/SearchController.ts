import type { Request, Response, NextFunction } from 'express';
import { webSearchService, type SearchSource } from '../services/WebSearchService.js';
import { sendSuccess } from '../utils/helpers.js';

export class SearchController {
  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = String(req.body.query ?? '');
      const sources = (req.body.sources as SearchSource[] | undefined) ?? [
        'google',
        'youtube',
        'reddit',
      ];
      const result = await webSearchService.search(query, sources);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };
}

export const searchController = new SearchController();
