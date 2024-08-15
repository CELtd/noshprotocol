
export class EigenvectorCentralityCalculator {
    private static dotProduct(a: number[], b: number[]): number {
        return a.reduce((sum, value, index) => sum + value * b[index], 0);
    }

    private static vectorNormalize(v: number[]): number[] {
        const norm = Math.sqrt(v.reduce((sum, value) => sum + value * value, 0));
        return v.map(value => value / norm);
    }

    private static matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
        return matrix.map(row => this.dotProduct(row, vector));
    }

    public static powerIteration(
        A: number[][], 
        b: number[], 
        nIter: number, 
        tol: number = 1e-2, 
        rng: () => number[] = () => Array(A[0].length).fill(0).map(() => Math.random())
    ): { eigenvector: number[] } {
        // Step 1: Initialize a random vector
        let r_k = rng();
        r_k = this.vectorNormalize(r_k);

        for (let i = 0; i < nIter; i++) {
            // Step 2: Compute y = A * r_k
            const y_k1 = this.matrixVectorMultiply(A, r_k).map((value, index) => value + b[index]);

            // Step 3: Compute the sign
            const mu = this.dotProduct(y_k1, r_k);

            // Step 4: Update r_k = y / ||y||
            const r_k1 = this.vectorNormalize(y_k1.map(value => Math.sign(mu) * value));

            // Step 5: Check for convergence
            if (Math.sqrt(this.dotProduct(r_k1.map((value, index) => value - r_k[index]), r_k1.map((value, index) => value - r_k[index]))) < tol) {
                return { eigenvector: r_k1 };
            }

            r_k = r_k1;
        }

        // // Compute the corresponding eigenvalue
        // const lambda_k = this.dotProduct(r_k, this.matrixVectorMultiply(A, r_k)) / this.dotProduct(r_k, r_k);
        return { eigenvector: r_k };
    }
}