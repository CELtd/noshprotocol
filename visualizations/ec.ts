import * as d3 from "d3";

interface Node extends d3.SimulationNodeDatum {
    id: number;
    weight: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
    weight: number;
}

const color = d3.scaleOrdinal(d3.schemeTableau10);
const plotSize = 200; // Adjust size as needed
const updateLimit = 500; // You can configure this value

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
    private simulation: d3.Simulation<Node, Link>;
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

        this.simulation = d3.forceSimulation<Node, Link>()
            .force("link", d3.forceLink<Node, Link>().id(d => d.id.toString()).distance(20))
            .force("charge", d3.forceManyBody().strength(-1))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2)); // Set a fixed center point
    }

    public initGraph(initialNodes: number, p: number): void {
        for (let i = 0; i < initialNodes; i++) {
            this.addNode();
        }
        this.updateGraph();
    }

    public addNode(): void {
        const newNode: Node = {
            id: this.nodeId++,
            weight: Math.random()
        };
        this.nodes.push(newNode);
        this.nodes.forEach(node => {
            if (node !== newNode && Math.random() < this.p) {
                this.links.push({ source: newNode, target: node, weight: Math.random() });
            }
        });
        this.updateGraph();
    }

    public addLink(source: Node, target: Node): void {
        const newLink: Link = {
            source,
            target,
            weight: Math.random()
        };
        this.links.push(newLink);

        if (newLink.weight > this.maxWeight) {
            this.maxWeight = newLink.weight;
        }

        this.updateGraph();
    }

    public updateGraph(): void {
        const links = this.svg.selectAll(".link")
            .data(this.links, d => `${d.source.id}-${d.target.id}`);
        
        links.enter()
            .append("line")
            .attr("class", "link")
            .merge(links)
            .style("stroke", d => d3.interpolateGreens(d.weight / this.maxWeight))
            .style("stroke-width", 1);
        
        const nodes = this.svg.selectAll(".node")
            .data(this.nodes, d => d.id);
        
        const nodeEnter = nodes.enter()
            .append("g")
            .attr("class", "node")
            .call(this.drag());

        nodeEnter.append("circle")
            .attr("r", 10)  // Adjust the radius size as needed
            .style("fill", d => this.getNodeColor(d))
            .style("stroke", "black")
            .style("stroke-width", 1);
        
        nodeEnter.append("text")
            .attr("dy", 4)
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .text(d => d.id.toString());

        nodes.merge(nodeEnter)
            .select("circle")
            .attr("r", 10)  // Adjust the radius size as needed
            .style("fill", d => this.getNodeColor(d))
            .style("stroke", "black");
        
        nodes.merge(nodeEnter)
            .select("text")
            .attr("dy", 4)
            .style("font-size", "10px");
        
        this.simulation.nodes(this.nodes);
        this.simulation.force<d3.ForceLink<Node, Link>>("link").links(this.links);
        this.simulation.alpha(1).restart();
        
        this.simulation.on("tick", () => {
            links
                .attr("x1", d => d.source.x)
                .attr("x2", d => d.target.x)
                .attr("y1", d => d.source.y)
                .attr("y2", d => d.target.y);
        
            nodes.select("circle")
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
            
            nodes.select("text")
                .attr("x", d => d.x)
                .attr("y", d => d.y);
        });
    
        // Update the center force to keep the graph centered
        this.simulation.force("center", d3.forceCenter(this.width / 2, this.height / 2));
        this.simulation.alpha(1).restart();
    }

    private drag() {
        return d3.drag()
            .on("start", (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on("end", (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }

    private getNodeColor(d: Node): string {
        return "lightgray"; // Default color
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
}

export class EigenvectorCentrality {
    private graph1: Graph;
    private graph2: Graph;
    private updateCounter: number = 0;
    private readonly updateLimit: number = 10;

    constructor(containerId1: string, containerId2: string, width: number, height: number, 
                private initialNodes1: number = 50, private p1: number = 0.1,
                private initialNodes2: number = 50, private p2: number = 0.05) {
        this.graph1 = new Graph(containerId1, width, height);
        this.graph2 = new Graph(containerId2, width, height);

        this.graph1.initGraph(this.initialNodes1, this.p1);
        this.graph2.initGraph(this.initialNodes2, this.p2);

        this.addColorBar();
        setInterval(() => this.step(), 250);
    }

    private step(): void {
        // Define the probability of adding a new link
        // const linkAdditionProbability = 0.1; // Adjust this probability as needed
    
        // // Add a new link with a certain probability
        // if (Math.random() < linkAdditionProbability) {
        //     this.graph1.addNode();
        // }
        // if (Math.random() < linkAdditionProbability) {
        //     this.graph2.addNode();
        // }
    
        // Highlight and update weights for existing links
        this.graph1.updateGraph();
        this.graph2.updateGraph();
    
        // Compute eigenvector centrality for both graphs
        const centralityMap1 = this.computeEigenvectorCentrality(this.graph1);
        const centralityMap2 = this.computeEigenvectorCentrality(this.graph2);
    
        // Update node sizes based on eigenvector centrality
        this.updateNodeSizes(centralityMap1, this.graph1);
        this.updateNodeSizes(centralityMap2, this.graph2);
    
        // Increment the update counter and check if it reached the limit
        this.updateCounter++;
        if (this.updateCounter >= this.updateLimit) {
            this.resetSimulation();
        }
    }
    
    private computeEigenvectorCentrality(graph: Graph): Map<number, number> {
        const adjacencyMatrix = graph.getAdjacencyMatrix();
        const b = Array(adjacencyMatrix.length).fill(0); // no doping
        const { eigenvector } = EigenvectorCentralityCalculator.powerIteration(adjacencyMatrix, b, 1000);

        const eigenvectorCentrality: { [key: number]: number } = {};
        graph.nodes.forEach((node, i) => {
            eigenvectorCentrality[node.id] = eigenvector[i];
        });

        return new Map<number, number>(Object.entries(eigenvectorCentrality).map(([id, centrality]) => [parseInt(id, 10), centrality]));
    }

    private updateNodeSizes(centralityMap: Map<number, number>, graph: Graph): void {
        const maxCentrality = Math.max(...centralityMap.values());
        const minCentrality = Math.min(...centralityMap.values());
        const sizeScale = d3.scaleLinear()
            .domain([minCentrality, maxCentrality])
            .range([5, 20]); // Adjust the range as needed for node sizes
    
        // Update nodes
        graph.svg.selectAll(".node")
            .select("circle")
            .transition()
            .duration(500)
            .attr("r", d => sizeScale(centralityMap.get(d.id) || 0)); // Update node radius
    }

    private addColorBar(): void {
        // Implement the color bar logic
    }

    private resetSimulation(): void {
        // Implement reset logic
    }
}
