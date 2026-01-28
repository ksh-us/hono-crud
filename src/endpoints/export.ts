import { z } from 'zod';
import type { Env } from 'hono';
import { ListEndpoint } from './list.js';
import type { MetaInput, OpenAPIRouteSchema, ListFilters, PaginatedResult } from '../core/types.js';
import type { ModelObject } from './types.js';
import {
  generateCsv,
  createCsvStream,
  type CsvGenerateOptions,
} from '../utils/csv.js';

// ============================================================================
// Export Types
// ============================================================================

/**
 * Supported export formats.
 */
export type ExportFormat = 'json' | 'csv';

/**
 * Options for the export operation.
 */
export interface ExportOptions {
  /** Export format (json or csv). */
  format: ExportFormat;
  /** Fields to include in the export. */
  fields?: string[];
  /** Whether to stream the response (for large exports). */
  stream?: boolean;
}

/**
 * Result of the export operation for JSON format.
 */
export interface ExportResult<T> {
  /** Exported records. */
  data: T[];
  /** Total number of records exported. */
  count: number;
  /** Export format used. */
  format: ExportFormat;
  /** Timestamp of the export. */
  exportedAt: string;
}

// ============================================================================
// ExportEndpoint Base Class
// ============================================================================

/**
 * Base endpoint for exporting resources in CSV or JSON format.
 * Extends ListEndpoint to leverage existing filtering, sorting, pagination, and field selection.
 *
 * Features:
 * - CSV and JSON export formats
 * - Streaming support for large exports via Web ReadableStream
 * - Uses all ListEndpoint features (filters, sort, field selection)
 * - Configurable max records and excluded fields
 * - Edge runtime compatible (Web APIs only)
 *
 * @example
 * ```ts
 * class UserExport extends MemoryExportEndpoint<Env, typeof userMeta> {
 *   _meta = userMeta;
 *   schema = { tags: ['Users'], summary: 'Export users' };
 *
 *   protected maxExportRecords = 10000;
 *   protected excludedExportFields = ['password', 'passwordHash'];
 *   protected filterFields = ['status', 'role'];
 * }
 * ```
 *
 * API Usage:
 * - `GET /users/export` - Export as JSON (default)
 * - `GET /users/export?format=csv` - Export as CSV
 * - `GET /users/export?format=csv&status=active` - Export with filters
 * - `GET /users/export?format=json&fields=id,name,email` - Export with field selection
 * - `GET /users/export?format=csv&stream=true` - Stream large exports
 */
export abstract class ExportEndpoint<
  E extends Env = Env,
  M extends MetaInput = MetaInput,
> extends ListEndpoint<E, M> {
  /** Maximum number of records that can be exported in a single request. */
  protected maxExportRecords: number = 10000;

  /** Whether to enable streaming for large exports. */
  protected enableStreaming: boolean = true;

  /** Fields to exclude from the export. */
  protected excludedExportFields: string[] = [];

  /** Default export format. */
  protected defaultFormat: ExportFormat = 'json';

  /** CSV generation options. */
  protected csvOptions: Partial<CsvGenerateOptions> = {};

  /** Custom filename for the export (without extension). */
  protected exportFilename?: string;

  /**
   * Returns the query parameter schema for export.
   * Extends the ListEndpoint schema with format and stream parameters.
   */
  protected getExportQuerySchema() {
    const baseSchema = this.getQuerySchema();
    return baseSchema.extend({
      format: z.enum(['json', 'csv']).optional().describe('Export format'),
      stream: z.enum(['true', 'false']).optional().describe('Enable streaming for large exports'),
    });
  }

  /**
   * Generates OpenAPI schema for the export endpoint.
   */
  getSchema(): OpenAPIRouteSchema {
    return {
      ...this.schema,
      request: {
        query: this.getExportQuerySchema(),
      },
      responses: {
        200: {
          description: 'Export successful',
          content: {
            'application/json': {
              schema: z.object({
                success: z.literal(true),
                result: z.object({
                  data: z.array(this._meta.model.schema),
                  count: z.number(),
                  format: z.enum(['json', 'csv']),
                  exportedAt: z.string(),
                }),
              }),
            },
            'text/csv': {
              schema: z.string(),
            },
          },
        },
      },
    };
  }

  /**
   * Parses export options from query parameters.
   */
  protected async getExportOptions(): Promise<ExportOptions> {
    const { query } = await this.getValidatedData();
    const format = (query?.format as ExportFormat) || this.defaultFormat;
    const stream = query?.stream === 'true' && this.enableStreaming;

    return {
      format,
      stream,
      fields: query?.fields ? String(query.fields).split(',') : undefined,
    };
  }

  /**
   * Gets the filename for the export.
   */
  protected getExportFilename(format: ExportFormat): string {
    const baseName = this.exportFilename || this._meta.model.tableName;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${baseName}-export-${timestamp}.${format}`;
  }

  /**
   * Prepares records for export by applying field exclusions.
   */
  protected prepareRecordsForExport(
    records: ModelObject<M['model']>[]
  ): Record<string, unknown>[] {
    if (this.excludedExportFields.length === 0) {
      return records as Record<string, unknown>[];
    }

    return records.map((record) => {
      const filtered: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
        if (!this.excludedExportFields.includes(key)) {
          filtered[key] = value;
        }
      }
      return filtered;
    });
  }

  /**
   * Exports records as JSON format.
   */
  protected exportAsJson(
    records: Record<string, unknown>[],
    format: ExportFormat
  ): Response {
    const result: ExportResult<Record<string, unknown>> = {
      data: records,
      count: records.length,
      format,
      exportedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ success: true, result }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${this.getExportFilename(format)}"`,
      },
    });
  }

  /**
   * Exports records as CSV format (non-streaming).
   */
  protected exportAsCsv(
    records: Record<string, unknown>[],
    format: ExportFormat
  ): Response {
    const csv = generateCsv(records, {
      ...this.csvOptions,
      excludeFields: this.excludedExportFields,
    });

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${this.getExportFilename(format)}"`,
      },
    });
  }

  /**
   * Exports records as CSV format with streaming.
   */
  protected exportAsCsvStream(
    records: Record<string, unknown>[],
    format: ExportFormat
  ): Response {
    const stream = createCsvStream(records, {
      ...this.csvOptions,
      excludeFields: this.excludedExportFields,
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${this.getExportFilename(format)}"`,
        'Transfer-Encoding': 'chunked',
      },
    });
  }

  /**
   * Lifecycle hook: called after records are fetched but before export.
   * Override to transform or filter records before export.
   */
  async beforeExport(
    records: ModelObject<M['model']>[]
  ): Promise<ModelObject<M['model']>[]> {
    return records;
  }

  /**
   * Fetches all records for export.
   * Overrides pagination to fetch up to maxExportRecords.
   */
  protected async fetchAllForExport(
    filters: ListFilters
  ): Promise<ModelObject<M['model']>[]> {
    // Override pagination to fetch all records up to the limit
    const exportFilters: ListFilters = {
      ...filters,
      options: {
        ...filters.options,
        page: 1,
        per_page: this.maxExportRecords,
      },
    };

    const result = await this.list(exportFilters);
    return result.result;
  }

  /**
   * Main handler for the export operation.
   */
  async handle(): Promise<Response> {

    const exportOptions = await this.getExportOptions();
    const filters = await this.getFilters();

    // Fetch all records for export
    let records = await this.fetchAllForExport(filters);

    // Apply after hook (from ListEndpoint)
    records = await this.after(records);

    // Apply beforeExport hook
    records = await this.beforeExport(records);

    // Prepare records (apply field exclusions)
    const preparedRecords = this.prepareRecordsForExport(records);

    // Export based on format
    if (exportOptions.format === 'csv') {
      if (exportOptions.stream && preparedRecords.length > 1000) {
        return this.exportAsCsvStream(preparedRecords, exportOptions.format);
      }
      return this.exportAsCsv(preparedRecords, exportOptions.format);
    }

    // Default: JSON
    return this.exportAsJson(preparedRecords, exportOptions.format);
  }
}
