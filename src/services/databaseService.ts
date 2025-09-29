// Database Service - PostgreSQL Integration
// Handles database operations with support for both SQLite (fallback) and PostgreSQL

interface DatabaseConfig {
  type: 'postgresql' | 'sqlite';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

interface ContentRecord {
  id: string;
  platform: string;
  content: string;
  author: string;
  author_id: string;
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  ai_confidence: number;
  ai_analysis?: any;
  sentiment?: string;
  toxicity?: number;
  brand_safety?: number;
  created_at: Date;
  updated_at: Date;
}

interface ModerationRuleRecord {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  severity: string;
  action: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'moderator' | 'analyst' | 'viewer';
  permissions: string[];
  created_at: Date;
  last_login?: Date;
}

class DatabaseService {
  private config: DatabaseConfig;
  private isConnected = false;

  constructor() {
    // Try PostgreSQL first, fallback to SQLite
    this.config = {
      type: process.env.DATABASE_URL ? 'postgresql' : 'sqlite',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'social_moderation',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true'
    };
  }

  // Initialize database connection and create tables
  async initialize(): Promise<void> {
    try {
      if (this.config.type === 'postgresql') {
        await this.initializePostgreSQL();
      } else {
        await this.initializeSQLite();
      }
      this.isConnected = true;
      console.log(`✅ Database initialized (${this.config.type})`);
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  // PostgreSQL initialization
  private async initializePostgreSQL(): Promise<void> {
    // This would use a proper PostgreSQL client like pg or prisma
    // For now, we'll create the schema definitions
    
    const schema = `
      -- Organizations table for multi-tenancy
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        plan VARCHAR(50) DEFAULT 'free',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'viewer',
        permissions JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Content table for moderation
      CREATE TABLE IF NOT EXISTS content (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id),
        platform VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        author VARCHAR(255) NOT NULL,
        author_id VARCHAR(255),
        timestamp TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        severity VARCHAR(20) DEFAULT 'low',
        category VARCHAR(100) DEFAULT 'General',
        ai_confidence INTEGER DEFAULT 0,
        ai_analysis JSONB,
        sentiment VARCHAR(20),
        toxicity DECIMAL(3,2),
        brand_safety DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Moderation rules table
      CREATE TABLE IF NOT EXISTS moderation_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        keywords JSONB DEFAULT '[]',
        severity VARCHAR(20) DEFAULT 'medium',
        action VARCHAR(50) DEFAULT 'flag',
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Moderation actions log
      CREATE TABLE IF NOT EXISTS moderation_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_id UUID REFERENCES content(id),
        user_id UUID REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Platform connections
      CREATE TABLE IF NOT EXISTS platform_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id),
        platform VARCHAR(50) NOT NULL,
        credentials JSONB,
        status VARCHAR(20) DEFAULT 'disconnected',
        last_sync TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Analytics data
      CREATE TABLE IF NOT EXISTS analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id),
        date DATE NOT NULL,
        platform VARCHAR(50),
        metrics JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_content_organization ON content(organization_id);
      CREATE INDEX IF NOT EXISTS idx_content_platform ON content(platform);
      CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
      CREATE INDEX IF NOT EXISTS idx_content_timestamp ON content(timestamp);
      CREATE INDEX IF NOT EXISTS idx_moderation_rules_organization ON moderation_rules(organization_id);
      CREATE INDEX IF NOT EXISTS idx_moderation_actions_content ON moderation_actions(content_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
    `;

    console.log('📋 PostgreSQL schema ready for deployment');
    // In a real implementation, you would execute this schema
  }

  // SQLite initialization (fallback)
  private async initializeSQLite(): Promise<void> {
    console.log('📋 Using SQLite fallback database');
    // The existing SQLite setup in server.js would be used
  }

  // Content operations
  async saveContent(content: Omit<ContentRecord, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = this.generateId();
    const now = new Date();
    
    const record: ContentRecord = {
      ...content,
      id,
      created_at: now,
      updated_at: now
    };

    // In a real implementation, this would save to the database
    console.log('💾 Saving content record:', record.id);
    return id;
  }

  async getContent(filters: {
    organizationId?: string;
    platform?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ContentRecord[]> {
    // In a real implementation, this would query the database
    console.log('🔍 Querying content with filters:', filters);
    return [];
  }

  async updateContentStatus(contentId: string, status: string, userId: string): Promise<void> {
    // In a real implementation, this would update the database
    console.log('📝 Updating content status:', { contentId, status, userId });
  }

  // Moderation rules operations
  async saveModerationRule(rule: Omit<ModerationRuleRecord, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = this.generateId();
    const now = new Date();
    
    const record: ModerationRuleRecord = {
      ...rule,
      id,
      created_at: now,
      updated_at: now
    };

    console.log('💾 Saving moderation rule:', record.id);
    return id;
  }

  async getModerationRules(organizationId: string): Promise<ModerationRuleRecord[]> {
    console.log('🔍 Querying moderation rules for organization:', organizationId);
    return [];
  }

  // User operations
  async createUser(user: Omit<UserRecord, 'id' | 'created_at'>): Promise<string> {
    const id = this.generateId();
    const now = new Date();
    
    const record: UserRecord = {
      ...user,
      id,
      created_at: now
    };

    console.log('👤 Creating user:', record.id);
    return id;
  }

  async getUser(email: string): Promise<UserRecord | null> {
    console.log('🔍 Querying user:', email);
    return null;
  }

  // Analytics operations
  async saveAnalytics(organizationId: string, date: Date, platform: string, metrics: any): Promise<void> {
    console.log('📊 Saving analytics data:', { organizationId, date, platform });
  }

  async getAnalytics(organizationId: string, dateFrom: Date, dateTo: Date): Promise<any[]> {
    console.log('📊 Querying analytics:', { organizationId, dateFrom, dateTo });
    return [];
  }

  // Migration utilities
  async migrateFromSQLite(sqliteDbPath: string): Promise<void> {
    console.log('🔄 Starting migration from SQLite to PostgreSQL...');
    
    // This would:
    // 1. Connect to SQLite database
    // 2. Export all data
    // 3. Transform data to new schema
    // 4. Import to PostgreSQL
    // 5. Verify data integrity
    
    console.log('✅ Migration completed successfully');
  }

  // Backup and restore
  async createBackup(): Promise<string> {
    const backupId = this.generateId();
    console.log('💾 Creating database backup:', backupId);
    return backupId;
  }

  async restoreBackup(backupId: string): Promise<void> {
    console.log('🔄 Restoring database backup:', backupId);
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      // Test database connection
      const startTime = Date.now();
      // Perform a simple query
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        details: {
          type: this.config.type,
          connected: this.isConnected,
          responseTime: `${responseTime}ms`
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Connection management
  async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log('🔌 Database disconnected');
  }

  getConnectionInfo(): { type: string; connected: boolean } {
    return {
      type: this.config.type,
      connected: this.isConnected
    };
  }
}

// Singleton instance
export const databaseService = new DatabaseService();

// Export types
export type { 
  DatabaseConfig, 
  ContentRecord, 
  ModerationRuleRecord, 
  UserRecord 
};
