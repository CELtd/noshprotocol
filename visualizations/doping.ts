import * as d3 from "d3";
import { EigenvectorCentralityCalculator } from "./noshlib";

interface Node extends d3.SimulationNodeDatum {
    id: number;
    weight: number;
    isCentral: boolean;
    centrality: number;
    centrality_doped: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
    weight: number;
}

const color = d3.scaleOrdinal(d3.schemeTableau10);

class Graph {
    public svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    public nodes: Node[] = [];
    public links: Link[] = [];
    
    private width: number;
    private height: number;
    private nodeId: number = 0;
    private maxWeight: number = 0;

    public simIndex: number = 0;

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
        // connect 3 to the central node for demonstration
        this.connectNextUnlinkedNode();
        this.connectNextUnlinkedNode();
        this.connectNextUnlinkedNode();

        // compute the eigenvector centrality of all the nodes, before and after doping
        this.computeEigenvectorCentrality();
        this.computeEigenvectorCentrality_doping();
    
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
        // console.log("updateGraph, simIndex: ", this.simIndex);
    
        // Combine centrality and centrality_doped values to find a common scale
        const allCentralityValues = [
            ...this.nodes.map(node => node.centrality || 0),
            ...this.nodes.map(node => node.centrality_doped || 0)
        ];
        
        const unifiedScale = d3.scaleLinear()
            .domain([Math.min(...allCentralityValues), Math.max(...allCentralityValues)])
            .range([5, 30]); // Minimum size 5, maximum size 30
        
        // Update nodes
        const nodes = this.svg.selectAll(".node")
            .data(this.nodes, d => d.id)
            .join(
                enter => {
                    const g = enter.append("g").classed("node", true);
                    g.append("circle")
                        .attr("r", d => unifiedScale(d.centrality || 0))
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
    
        // Update node sizes and colors based on simIndex
        nodes.select("circle")
            .attr("r", d => {
                if (this.simIndex === 0) {
                    return unifiedScale(d.centrality || 0); // Default size based on centrality
                } else if (this.simIndex === 1) {
                    return d.isCentral ? unifiedScale(d.centrality_doped || 0) : unifiedScale(d.centrality || 0);
                } else if (this.simIndex === 2) {
                    return unifiedScale(d.centrality_doped || 0); // All nodes size based on centrality_doped
                }
                return unifiedScale(d.centrality || 0); // Fallback to default
            })
            .style("fill", d => {
                if (this.simIndex > 0 && d.isCentral) {
                    return "lightgreen"; // Color the central node light green in simIndex 1
                }
                return this.getNodeColor(d);
            });

    
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
        return "lightblue";
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

    private computeEigenvectorCentrality_doping(): void {
        const adjacencyMatrix = this.getAdjacencyMatrix();
        const b = Array(adjacencyMatrix.length).fill(0); // no doping
        b[0] = 1; // doping the central node
        const { eigenvector } = EigenvectorCentralityCalculator.powerIteration(adjacencyMatrix, b, 1000);
    
        this.nodes.forEach((node, i) => {
            node.centrality_doped = eigenvector[i];
        });
    }    
}

export class DopingViz {
    private graph1: Graph;
    private updateCounter: number = 0;
    private updateLimit;
    private simIndexText: d3.Selection<SVGTextElement, unknown, null, undefined>;

    constructor(
        containerId1: string, 
        width: number, 
        height: number, 
        private initialNodes1: number = 50
    ) {
        this.graph1 = new Graph(containerId1, width, height);
        this.graph1.initGraph(this.initialNodes1);

        // Add the text bar to display simulation index
        const container = d3.select(`#${containerId1}`);
        this.simIndexText = container.select("svg")
            .append("text")
            .attr("x", 10)
            .attr("y", 20)
            .attr("fill", "black")
            .style("font-size", "16px")
            .style("font-family", "Arial")
            .text(`Simulation Index: ${this.graph1.simIndex}`);

        this.addColorBar();
        this.updateLimit = 3;
        setInterval(() => this.step(), 2000);
    }

    private step(): void {
        // Highlight and update weights for existing links
        this.graph1.updateGraph();

        // Update the simulation index text
        if (this.graph1.simIndex === 0) {
            this.simIndexText.text(`Simulation Index: ${this.graph1.simIndex} - No Doping`);
        }
        else if (this.graph1.simIndex === 1) {
            this.simIndexText.text(`Simulation Index: ${this.graph1.simIndex} - Central Node Doped`);
        }
        else if (this.graph1.simIndex === 2) {
            this.simIndexText.text(`Simulation Index: ${this.graph1.simIndex} - Propagation of Doping Effect on EC`);
        }
        

        // Reset simIndex
        this.graph1.simIndex++;
        if (this.graph1.simIndex > 2) {
            this.graph1.simIndex = 0;
        }
    }

    private addColorBar(): void {
        // Implement the color bar logic
    }
}
