import * as d3 from "d3";

interface Node extends d3.SimulationNodeDatum {
    id: number;
    weight: number;
    isCentral: boolean;
    centrality: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
    weight: number;
}

const color = d3.scaleOrdinal(d3.schemeTableau10);

class EigenvectorCentralityCalculator {
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

class Graph {
    public svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    public nodes: Node[] = [];
    public links: Link[] = [];
    
    private width: number;
    private height: number;
    private nodeId: number = 0;
    private maxWeight: number = 0;

    constructor(containerId: string, width: number, height: number) {
        const container = d3.select(`#${containerId}`);
        this.width = width;
        this.height = height;
    
        this.svg = container.append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .style("display", "block")
            .style("overflow", "hidden");
    }

    public initGraph(initialNodes: number): void {
        if (initialNodes < 1) return; // Ensure there's at least one node for the ring
    
        // Clear existing nodes and links if any
        this.nodes = [];
        this.links = [];
        this.nodeId = 0;
        this.maxWeight = 0;
    
        // Central node
        this.addNode(true);  // Central node
        this.nodes[0].x = this.width / 2;
        this.nodes[0].y = this.height / 2;
        this.nodes[0].fx = this.width / 2;  // Fix position
        this.nodes[0].fy = this.height / 2;
    
        // Calculate radius for the circle of nodes
        const radius = Math.min(this.width, this.height) / 3;  // Adjust radius as needed
    
        // Add ring nodes
        for (let i = 0; i < initialNodes; i++) {
            this.addNode(false); // Regular node
            const angle = (i / initialNodes) * 2 * Math.PI; // Angle in radians
            this.nodes[i + 1].x = this.width / 2 + radius * Math.cos(angle);
            this.nodes[i + 1].y = this.height / 2 + radius * Math.sin(angle);
        }
    
        // Connect ring nodes
        for (let i = 1; i <= initialNodes; i++) {
            let nextIndex = (i % initialNodes) + 1;  // Wrap around to the first node
            this.addLink(this.nodes[i], this.nodes[nextIndex]);
        }
    
        this.updateGraph();
    }
    
    
    public addNode(isCentral: boolean = false): void {
        const newNode: Node = {
            id: this.nodeId++,
            weight: isCentral ? 1 : Math.random(), // Optionally give the central node different characteristics
            isCentral: isCentral // Flag to identify the central node
        };
        this.nodes.push(newNode);
        if (!isCentral) {
            // Optionally initialize connections or specific properties for non-central nodes
        }
        this.updateGraph();
    }

    public connectNextUnlinkedNode(): void {
        const centralNode = this.nodes[0];
        const connectedNodes = new Set(this.links
            .filter(link => link.source === centralNode || link.target === centralNode)
            .map(link => link.source === centralNode ? link.target.id : link.source.id));
    
        for (let i = 1; i < this.nodes.length; i++) {
            if (!connectedNodes.has(this.nodes[i].id)) {
                this.addLink(centralNode, this.nodes[i]);
                this.computeEigenvectorCentrality(); // Recompute centrality every time a link is added
                this.updateGraph();
                break;
            }
        }
    }    

    public addLink(source: Node, target: Node): void {
        const newLink: Link = {
            source,
            target,
            weight: 1
            // weight: Math.random()
        };
        this.links.push(newLink);

        if (newLink.weight > this.maxWeight) {
            this.maxWeight = newLink.weight;
        }

        this.updateGraph();
    }

    public updateGraph(): void {
        // Assuming centrality is already computed and stored in each node
    
        // Define a scale for node sizes
        const centralityValues = this.nodes.map(node => node.centrality || 0);
        const sizeScale = d3.scaleLinear()
                            .domain([Math.min(...centralityValues), Math.max(...centralityValues)])
                            .range([5, 20]); // Minimum size 5, maximum size 20
    
        // Update nodes
        const nodes = this.svg.selectAll(".node")
            .data(this.nodes, d => d.id)
            .join(
                enter => {
                    const g = enter.append("g").classed("node", true);
                    g.append("circle")
                        .attr("r", d => sizeScale(d.centrality || 0))
                        .style("fill", d => this.getNodeColor(d))
                        .style("stroke", "black")
                        .style("stroke-width", 2);
                    g.append("text")
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "middle")
                        .text(d => d.id.toString());
                    return g;
                },
                update => update,
                exit => exit.remove()
            );
    
        nodes.select("circle")
            .attr("r", d => sizeScale(d.centrality || 0));  // Update the radius based on centrality
    
        nodes.attr("transform", d => `translate(${d.x}, ${d.y})`);
    
        // Update links
        const links = this.svg.selectAll(".link")
            .data(this.links, d => `${d.source.id}-${d.target.id}`)
            .join("line")
            .classed("link", true)
            .attr("x1", d => d.source.x)
            .attr("x2", d => d.target.x)
            .attr("y1", d => d.source.y)
            .attr("y2", d => d.target.y)
            .attr("stroke", d => d3.interpolateGreens(d.weight / this.maxWeight))
            .attr("stroke-width", 2);
    
        links.exit().remove();
    }
     

    private getNodeColor(d: Node): string {
        // Calculate the total weight of all nodes
        const totalWeight = this.nodes.reduce((acc, node) => acc + node.weight, 0);
    
        // Define a color scale; you might adjust the color range as needed
        const scale = d3.scaleSequential(d3.interpolateBlues)
            .domain([0, 1]);  // Normalized range from 0 to 1
    
        // Normalize this node's weight
        const normalizedWeight = d.weight / totalWeight;
    
        // Return the color for this normalized weight
        return scale(normalizedWeight);
    }
    
    public getAdjacencyMatrix(): number[][] {
        const size = this.nodes.length;
        const matrix: number[][] = Array(size).fill(0).map(() => Array(size).fill(0));
        
        this.links.forEach(link => {
            const sourceIndex = this.nodes.findIndex(node => node.id === link.source.id);
            const targetIndex = this.nodes.findIndex(node => node.id === link.target.id);
            matrix[sourceIndex][targetIndex] = link.weight;
            matrix[targetIndex][sourceIndex] = link.weight;
        });
        
        return matrix;
    }

    private computeEigenvectorCentrality(): void {
        const adjacencyMatrix = this.getAdjacencyMatrix();
        const b = Array(adjacencyMatrix.length).fill(0); // no doping
        const { eigenvector } = EigenvectorCentralityCalculator.powerIteration(adjacencyMatrix, b, 1000);
    
        this.nodes.forEach((node, i) => {
            node.centrality = eigenvector[i];
        });
    }    
}

export class ECViz {
    private graph1: Graph;
    private graph2: Graph;
    private updateCounter: number = 0;
    private updateLimit;

    constructor(containerId1: string, width: number, height: number, 
                private initialNodes1: number = 50, private p1: number = 0.1) {
        
                    this.graph1 = new Graph(containerId1, width, height);
        this.graph1.initGraph(this.initialNodes1);

        this.addColorBar();
        this.updateLimit = initialNodes1 + 1;
        setInterval(() => this.step(), 1000);
    }

    private step(): void {
    
        // Highlight and update weights for existing links
        this.graph1.connectNextUnlinkedNode();
        this.graph1.updateGraph();
    
        // Increment the update counter and check if it reached the limit
        this.updateCounter++;
        if (this.updateCounter >= this.updateLimit) {
            this.resetSimulation();
        }
    }

    private addColorBar(): void {
        // Implement the color bar logic
    }

    private resetSimulation(): void {
        // Clear existing SVG elements
        this.graph1.svg.selectAll("*").remove();  // This removes every element within the SVG, ensuring no old links or nodes persist.
        
        // Reinitialize the graph
        this.graph1.initGraph(this.initialNodes1);

        this.updateCounter = 0;
    }
    
}
