export class IntegrityService {
  constructor(private db: D1Database) {}

  async brandExists(brandId: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 AS one FROM conBrands WHERE id = ?')
      .bind(brandId)
      .first();
    return row !== null;
  }

  async campaignExists(brandId: string, campaignId: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 AS one FROM conCampaigns WHERE id = ? AND brandId = ?')
      .bind(campaignId, brandId)
      .first();
    return row !== null;
  }

  async pillarExistsAndActive(brandId: string, pillarId: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 AS one FROM conPillars WHERE id = ? AND brandId = ? AND isActive = 1')
      .bind(pillarId, brandId)
      .first();
    return row !== null;
  }

  async ideaExistsAndApproved(brandId: string, ideaId: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT 1 AS one FROM conIdeas WHERE id = ? AND brandId = ? AND status = 'idea_approved'")
      .bind(ideaId, brandId)
      .first();
    return row !== null;
  }

  async draftExists(brandId: string, draftId: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 AS one FROM conDrafts WHERE id = ? AND brandId = ?')
      .bind(draftId, brandId)
      .first();
    return row !== null;
  }

  async revisionExists(brandId: string, draftId: string, revisionNumber: number): Promise<boolean> {
    const row = await this.db
      .prepare(
        'SELECT 1 AS one FROM conDraftRevisions WHERE draftId = ? AND brandId = ? AND revisionNumber = ?'
      )
      .bind(draftId, brandId, revisionNumber)
      .first();
    return row !== null;
  }
}
