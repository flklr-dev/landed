// ─────────────────────────────────────────────────────────────────────────────
// Landed — Local Embeddings (all-MiniLM-L6-v2)
// Runs entirely on CPU — no GPU required, no per-call API cost.
//
// Trade-off: all-MiniLM-L6-v2 produces 384-dim vectors. It's small, fast,
// and "good enough" for this use case (cosine similarity between job
// descriptions and resumes). A larger model would be marginally more accurate
// but would add startup time and memory on every worker instance.
// ─────────────────────────────────────────────────────────────────────────────

let pipeline: ((text: string | string[], options?: Record<string, unknown>) => Promise<{ data: Float32Array }>) | null = null;

/**
 * Lazily load the embedding model on first use.
 * The model is cached after first load (~30MB download, ~100ms inference).
 */
async function getEmbeddingPipeline() {
  if (!pipeline) {
    // Dynamic import to avoid loading the model until needed
    const { pipeline: createPipeline } = await import('@xenova/transformers');
    pipeline = (await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as unknown as typeof pipeline;
    console.log('[Embeddings] Model loaded: all-MiniLM-L6-v2 (384-dim)');
  }
  return pipeline!;
}

/**
 * Generate a 384-dimensional embedding vector for the given text.
 * Returns a plain number array suitable for pgvector storage.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const embed = await getEmbeddingPipeline();
  const output = await embed(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal).
 * Used as a fallback when pgvector's <=> operator isn't available.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dot / denominator;
}
