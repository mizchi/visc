/**
 * Phase 2: Baseline Management Service
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaselineLayout } from '../phase1-layout/types';
import { BaselineVersion, BaselineCollection, BaselineUpdateRequest } from './types';

export class BaselineManager {
  private collections: Map<string, BaselineCollection> = new Map();
  
  constructor(private readonly options: {
    storagePath: string;
    maxVersions?: number;
  }) {}
  
  async initialize(): Promise<void> {
    await this.loadCollections();
  }
  
  async createBaseline(
    url: string,
    layout: BaselineLayout,
    metadata?: Partial<BaselineVersion['metadata']>
  ): Promise<BaselineCollection> {
    const collectionId = this.generateCollectionId(url);
    
    const version: BaselineVersion = {
      id: `v-${Date.now()}`,
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layout,
      metadata: {
        url,
        ...metadata
      }
    };
    
    const collection: BaselineCollection = {
      id: collectionId,
      name: new URL(url).pathname || 'home',
      url,
      versions: [version],
      activeVersion: version.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.collections.set(collectionId, collection);
    await this.saveCollection(collection);
    
    return collection;
  }
  
  async updateBaseline(request: BaselineUpdateRequest): Promise<BaselineVersion> {
    const collection = this.collections.get(request.collectionId);
    if (!collection) {
      throw new Error(`Collection ${request.collectionId} not found`);
    }
    
    const latestVersion = this.getLatestVersion(collection);
    const newVersionNumber = this.incrementVersion(latestVersion.version);
    
    const newVersion: BaselineVersion = {
      id: `v-${Date.now()}`,
      version: newVersionNumber,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layout: request.newLayout,
      metadata: {
        ...latestVersion.metadata,
        description: request.reason,
        approvedBy: request.author,
        approvalDate: Date.now()
      }
    };
    
    collection.versions.push(newVersion);
    collection.activeVersion = newVersion.id;
    collection.updatedAt = Date.now();
    
    // Apply version limit
    if (this.options.maxVersions && collection.versions.length > this.options.maxVersions) {
      collection.versions = collection.versions.slice(-this.options.maxVersions);
    }
    
    await this.saveCollection(collection);
    
    return newVersion;
  }
  
  async getActiveBaseline(url: string): Promise<BaselineLayout | null> {
    const collectionId = this.generateCollectionId(url);
    const collection = this.collections.get(collectionId);
    
    if (!collection || !collection.activeVersion) {
      return null;
    }
    
    const activeVersion = collection.versions.find(
      v => v.id === collection.activeVersion
    );
    
    return activeVersion?.layout || null;
  }
  
  async getBaselineHistory(url: string): Promise<BaselineVersion[]> {
    const collectionId = this.generateCollectionId(url);
    const collection = this.collections.get(collectionId);
    
    return collection?.versions || [];
  }
  
  async setActiveVersion(url: string, versionId: string): Promise<void> {
    const collectionId = this.generateCollectionId(url);
    const collection = this.collections.get(collectionId);
    
    if (!collection) {
      throw new Error(`Collection for ${url} not found`);
    }
    
    const version = collection.versions.find(v => v.id === versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }
    
    collection.activeVersion = versionId;
    collection.updatedAt = Date.now();
    
    await this.saveCollection(collection);
  }
  
  private async loadCollections(): Promise<void> {
    const collectionsPath = path.join(this.options.storagePath, 'collections');
    
    try {
      const files = await fs.readdir(collectionsPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filepath = path.join(collectionsPath, file);
          const content = await fs.readFile(filepath, 'utf-8');
          const collection: BaselineCollection = JSON.parse(content);
          this.collections.set(collection.id, collection);
        }
      }
    } catch (error) {
      // Directory might not exist yet
    }
  }
  
  private async saveCollection(collection: BaselineCollection): Promise<void> {
    const collectionsPath = path.join(this.options.storagePath, 'collections');
    await fs.mkdir(collectionsPath, { recursive: true });
    
    const filepath = path.join(collectionsPath, `${collection.id}.json`);
    await fs.writeFile(filepath, JSON.stringify(collection, null, 2));
  }
  
  private generateCollectionId(url: string): string {
    return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }
  
  private getLatestVersion(collection: BaselineCollection): BaselineVersion {
    return collection.versions[collection.versions.length - 1];
  }
  
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2]) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }
}