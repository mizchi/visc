/**
 * バリデーターチェーンの実装
 */

import type { 
  Validator, 
  ValidatorChain, 
  ValidationResult, 
  ValidationContext 
} from './types.js';

/**
 * バリデーターチェーンの実装
 */
export class ValidatorChainImpl implements ValidatorChain {
  validators: Validator[] = [];
  
  constructor(validators: Validator[] = []) {
    this.validators = validators;
  }
  
  /**
   * バリデーターを追加
   */
  add(validator: Validator): this {
    this.validators.push(validator);
    return this;
  }
  
  /**
   * すべてのバリデーターを順次実行
   */
  async validateAll<T>(
    input: T,
    context: ValidationContext
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const validator of this.validators) {
      try {
        const result = await validator.validate(input, context);
        results.push(result);
      } catch (error) {
        results.push({
          passed: false,
          validatorName: validator.name,
          confidence: 0,
          message: `バリデーションエラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: {
            error: error instanceof Error ? error.message : error
          }
        });
      }
    }
    
    return results;
  }
  
  /**
   * 最初に失敗したバリデーターで停止
   */
  async validateUntilFail<T>(
    input: T,
    context: ValidationContext
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const validator of this.validators) {
      try {
        const result = await validator.validate(input, context);
        results.push(result);
        
        // 失敗した場合は停止
        if (!result.passed) {
          break;
        }
      } catch (error) {
        results.push({
          passed: false,
          validatorName: validator.name,
          confidence: 0,
          message: `バリデーションエラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: {
            error: error instanceof Error ? error.message : error
          }
        });
        break;
      }
    }
    
    return results;
  }
  
  /**
   * 並列でバリデーターを実行
   */
  async validateParallel<T>(
    input: T,
    context: ValidationContext
  ): Promise<ValidationResult[]> {
    const promises = this.validators.map(validator => 
      validator.validate(input, context).catch(error => ({
        passed: false,
        validatorName: validator.name,
        confidence: 0,
        message: `バリデーションエラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {
          error: error instanceof Error ? error.message : error
        }
      }))
    );
    
    return Promise.all(promises);
  }
}

/**
 * 条件付きバリデーターチェーン
 */
export class ConditionalValidatorChain extends ValidatorChainImpl {
  private conditions: Map<Validator, (input: any, context: ValidationContext) => boolean> = new Map();
  
  /**
   * 条件付きでバリデーターを追加
   */
  addConditional(
    validator: Validator,
    condition: (input: any, context: ValidationContext) => boolean
  ): this {
    super.add(validator);
    this.conditions.set(validator, condition);
    return this;
  }
  
  /**
   * 条件を満たすバリデーターのみ実行
   */
  async validateAll<T>(
    input: T,
    context: ValidationContext
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const validator of this.validators) {
      const condition = this.conditions.get(validator);
      
      // 条件が設定されていて、満たさない場合はスキップ
      if (condition && !condition(input, context)) {
        results.push({
          passed: true,
          validatorName: validator.name,
          confidence: 1,
          message: 'スキップ（条件を満たさない）',
          details: {
            skipped: true,
            reason: 'Condition not met'
          }
        });
        continue;
      }
      
      try {
        const result = await validator.validate(input, context);
        results.push(result);
      } catch (error) {
        results.push({
          passed: false,
          validatorName: validator.name,
          confidence: 0,
          message: `バリデーションエラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: {
            error: error instanceof Error ? error.message : error
          }
        });
      }
    }
    
    return results;
  }
}

/**
 * 重み付きバリデーターチェーン
 */
export class WeightedValidatorChain extends ValidatorChainImpl {
  private weights: Map<Validator, number> = new Map();
  
  /**
   * 重み付きでバリデーターを追加
   */
  addWeighted(validator: Validator, weight: number = 1): this {
    super.add(validator);
    this.weights.set(validator, weight);
    return this;
  }
  
  /**
   * 重み付き集計結果を返す
   */
  async validateWithScore<T>(
    input: T,
    context: ValidationContext
  ): Promise<{
    results: ValidationResult[];
    overallScore: number;
    passed: boolean;
  }> {
    const results = await this.validateAll(input, context);
    
    let totalWeight = 0;
    let weightedScore = 0;
    
    for (const result of results) {
      const validator = this.validators.find(v => v.name === result.validatorName);
      if (!validator) continue;
      
      const weight = this.weights.get(validator) || 1;
      totalWeight += weight;
      
      if (result.passed) {
        weightedScore += weight * result.confidence;
      }
    }
    
    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const passed = overallScore >= 0.8; // 80%以上で合格
    
    return {
      results,
      overallScore,
      passed
    };
  }
}

/**
 * バリデーターチェーンのビルダー
 */
export class ValidatorChainBuilder {
  private chain: ValidatorChainImpl;
  
  constructor(type: 'sequential' | 'conditional' | 'weighted' = 'sequential') {
    switch (type) {
      case 'conditional':
        this.chain = new ConditionalValidatorChain();
        break;
      case 'weighted':
        this.chain = new WeightedValidatorChain();
        break;
      default:
        this.chain = new ValidatorChainImpl();
    }
  }
  
  /**
   * バリデーターを追加
   */
  add(validator: Validator): this {
    this.chain.add(validator);
    return this;
  }
  
  /**
   * 条件付きでバリデーターを追加
   */
  addIf(
    validator: Validator,
    condition: (input: any, context: ValidationContext) => boolean
  ): this {
    if (this.chain instanceof ConditionalValidatorChain) {
      this.chain.addConditional(validator, condition);
    } else {
      throw new Error('Conditional add requires a conditional chain');
    }
    return this;
  }
  
  /**
   * 重み付きでバリデーターを追加
   */
  addWeighted(validator: Validator, weight: number): this {
    if (this.chain instanceof WeightedValidatorChain) {
      this.chain.addWeighted(validator, weight);
    } else {
      throw new Error('Weighted add requires a weighted chain');
    }
    return this;
  }
  
  /**
   * チェーンを構築
   */
  build(): ValidatorChain {
    return this.chain;
  }
}