import * as d3 from "d3";
import { zoom as d3Zoom } from 'd3-zoom';

interface Node extends d3.SimulationNodeDatum {
    id: number;
    type: 'buyer' | 'seller';
    weight: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
    weight: number;
}

const color = d3.scaleOrdinal(d3.schemeTableau10);
const plotSize = 200; // Adjust size as needed
const updateLimit = 500; // You can configure this value

export class ErdosRenyiGraph {
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private width: number;
    private height: number;
    private nodes: Node[] = [];
    private links: Link[] = [];
    private weightSums: number[] = [];
    private simulation: d3.Simulation<Node, Link>;
    private nodeId: number = 0;
    private maxWeight: number = 0;  // Initialize with zero or the starting maximum weight
    private updateCounter: number = 0;
    

    private graphGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    private matrixGroup: d3.Selection<SVGGElement, unknown, null, undefined>;

    constructor(containerId: string, private initialNodes: number = 50, private p: number = 0.1) {
        const container = d3.select(`#${containerId}`);
        this.width = parseInt(container.style("width"), 10) || container.node().getBoundingClientRect().width;
        this.height = parseInt(container.style("height"), 10) || container.node().getBoundingClientRect().height;
    
        this.svg = container.append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .style("display", "block")
            .style("overflow", "hidden");
    
        this.graphGroup = this.svg.append("g")
            .attr("class", "graph")
            .attr("transform", `translate(0, 0)`); // Position graph on the left side
        this.matrixGroup = this.svg.append("g")
            .attr("class", "matrix")
            .attr("transform", `translate(${this.width - plotSize}, 15)`); // Position matrix on the right side
        this.svg.append('text')
            .attr('x', this.width - plotSize/2)
            .attr('y', 10)
            .style('text-anchor', 'end')
            .text('Adjacency Matrix')
            .style('font-size', '12px');
    
        this.svg.append("g")
            .attr("class", "colorbar-legend")
            .attr("transform", `translate(${this.width / 2 - 10}, 0)`); // Adjusted for left side
    
        this.svg.append("g")
            .attr("class", "line-graph")
            .attr("transform", `translate(22, ${plotSize + 180})`); // Position line graph on the bottom right
        this.svg.append('text')
            .attr('x', plotSize/2)
            .attr('y', this.height - plotSize - 35)
            .style('text-anchor', 'end')
            .text('Graph Value')
            .style('font-size', '12px');
    
        this.simulation = d3.forceSimulation<Node, Link>()
            .force("link", d3.forceLink<Node, Link>().id(d => d.id.toString()).distance(20))
            .force("charge", d3.forceManyBody().strength(-100))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2)); // Set a fixed center point
    
        this.initGraph();
        this.addLegend();
        this.addColorBar();
        setInterval(() => this.highlightRandomEdge(), 250);
    }

    private initGraph(): void {
        for (let i = 0; i < this.initialNodes; i++) {
            this.addNode();
        }
        this.updateGraph();
        this.updateAdjacencyMatrix(); // Initial call to draw the matrix
    }

    private addNode(): void {
        const newNode: Node = {
            id: this.nodeId++,
            type: Math.random() < 0.5 ? 'buyer' : 'seller',
            weight: Math.random()
        };
        this.nodes.push(newNode);
        this.nodes.forEach(node => {
            if (node !== newNode && node.type !== newNode.type && Math.random() < this.p) {
                this.links.push({ source: newNode, target: node, weight: Math.random() });
            }
        });
        this.updateGraph();
        this.updateAdjacencyMatrix(); // Update the matrix after adding a node
    }

    private updateGraph(): void {
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
        
        nodes.enter()
            .append("circle")
            .attr("class", "node")
            .attr("r", 5)
            .merge(nodes)
            .style("fill", d => color(d.type));
        
        this.simulation.nodes(this.nodes);
        this.simulation.force<d3.ForceLink<Node, Link>>("link").links(this.links);
        this.simulation.alpha(1).restart();
        
        this.simulation.on("tick", () => {
            links
                .attr("x1", d => d.source.x)
                .attr("x2", d => d.target.x)
                .attr("y1", d => d.source.y)
                .attr("y2", d => d.target.y);
        
            nodes
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });
    
        // Re-calculate the bounding box and adjust the simulation center
        const bbox = this.graphGroup.node().getBBox();
        const graphCenterX = bbox.x + bbox.width / 2;
        const graphCenterY = bbox.y + bbox.height / 2;
    
        // Update the center force to keep the graph centered
        this.simulation.force("center", d3.forceCenter(this.width / 2, this.height / 2));
        this.simulation.alpha(1).restart();
    }
    

    private adjustViewBox(): void {
        // Calculate the bounding box of the graph and matrix
        const graphBbox = this.graphGroup.node().getBBox();
        const matrixBbox = this.matrixGroup.node().getBBox();
        
        // Compute the combined bounding box
        const bbox = {
            x: Math.min(graphBbox.x, matrixBbox.x),
            y: Math.min(graphBbox.y, matrixBbox.y),
            width: Math.max(graphBbox.x + graphBbox.width, matrixBbox.x + matrixBbox.width) - Math.min(graphBbox.x, matrixBbox.x),
            height: Math.max(graphBbox.y + graphBbox.height, matrixBbox.y + matrixBbox.height) - Math.min(graphBbox.y, matrixBbox.y)
        };

        // Adjust the viewBox to fit the combined graph and matrix
        this.svg.attr("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
    }


    private highlightRandomEdge(): void {
        // Define the probability for adding a new node
        const addNodeProbability = 0.1; // Adjust this probability as needed
    
        // Add a new node with some probability
        let newNode: Node | null = null;
        if (Math.random() < addNodeProbability) {
            newNode = {
                id: this.nodeId++,
                type: Math.random() < 0.5 ? 'buyer' : 'seller',
                weight: Math.random()
            };
            this.nodes.push(newNode);
            this.updateGraph();
            this.updateAdjacencyMatrix();
        }
    
        // Define variables for the nodes to connect
        let sourceNode: Node;
        let targetNode: Node;
    
        // Check if a new node was added
        if (newNode) {
            // If a new node is added, connect it to a random node of the opposite type
            const oppositeType = newNode.type === 'buyer' ? 'seller' : 'buyer';
            const oppositeNodes = this.nodes.filter(node => node.type === oppositeType);
    
            if (oppositeNodes.length > 0) {
                targetNode = oppositeNodes[Math.floor(Math.random() * oppositeNodes.length)];
                sourceNode = newNode;
            }
        } else {
            // If no new node was added, randomly choose a subset of nodes to connect
            const buyers = this.nodes.filter(node => node.type === 'buyer');
            const sellers = this.nodes.filter(node => node.type === 'seller');
    
            if (buyers.length > 0 && sellers.length > 0 && Math.random() < 0.3) { // Probability to add a new edge
                sourceNode = buyers[Math.floor(Math.random() * buyers.length)];
                targetNode = sellers[Math.floor(Math.random() * sellers.length)];
            }
        }
    
        // Add a new edge if both nodes are defined and no edge already exists between them
        if (sourceNode && targetNode && !this.links.some(link =>
            (link.source === sourceNode && link.target === targetNode) ||
            (link.source === targetNode && link.target === sourceNode))) {
    
            // Add a new edge with an initial weight
            const newLink: Link = {
                source: sourceNode,
                target: targetNode,
                weight: Math.random()  // Initial weight for the new edge
            };
            this.links.push(newLink);
    
            // Update maximum weight if necessary
            if (newLink.weight > this.maxWeight) {
                this.maxWeight = newLink.weight;
            }
    
            // Update the graph and restart the simulation
            this.updateGraph();
            this.updateAdjacencyMatrix();
        }
    
        // Proceed with highlighting existing edges
        const buyerSellerLinks = this.links.filter(link =>
            (link.source.type === 'buyer' && link.target.type === 'seller') ||
            (link.source.type === 'seller' && link.target.type === 'buyer')
        );
    
        buyerSellerLinks.forEach(link => {
            if (Math.random() < 0.02) {  // Highlight probability
                link.weight += 0.1;  // Increment the weight
                // Update the maximum weight if this link's new weight is higher
                if (link.weight > this.maxWeight) {
                    this.maxWeight = link.weight;
                }
    
                // Select the specific link and apply the yellow highlight
                const linkSelection = this.svg.selectAll(".link")
                    .filter(d => d === link)
                    .classed("highlighted", true);
    
                // Temporary yellow flash
                linkSelection
                    .transition()
                    .duration(500)
                    .style("stroke", "yellow")
                    .style("stroke-width", 4)
                    .style("stroke-opacity", 0.5)
                    .transition()
                    .duration(500)
                    .style("stroke-opacity", 1)
                    .transition()
                    .duration(500)
                    .style("stroke", d => d3.interpolateGreens(d.weight / this.maxWeight))
                    .style("stroke-width", 2);
            }
        });
    
        // Calculate and store the sum of all weights
        const totalWeight = this.links.reduce((sum, link) => sum + link.weight, 0);
        this.weightSums.push(totalWeight);
    
        this.updateLineGraph(); // Update the line graph with the new weight sums
        this.updateAdjacencyMatrix(); // Update matrix after highlighting edges
    
        // Increment the update counter and check if it reached the limit
        this.updateCounter++;
        if (this.updateCounter >= updateLimit) {
            this.resetSimulation();
        }
    }
    
    

    private resetSimulation(): void {
        this.nodes = [];
        this.links = [];
        this.weightSums = [];
        this.nodeId = 0;
        this.maxWeight = 0;
        this.updateCounter = 0;
        
        this.initGraph();
        this.updateGraph();
        this.updateAdjacencyMatrix();
        this.updateLineGraph();
    }
    

    private updateLineGraph(): void {
        const lineGroup = this.svg.select(".line-graph");
    
        // Define the scales
        const xScale = d3.scaleLinear()
            .domain([0, this.weightSums.length - 1])
            .range([0, plotSize]);
    
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(this.weightSums)])
            .range([plotSize, 0]);
    
        // Define the line
        const line = d3.line<number>()
            .x((d, i) => xScale(i))
            .y(d => yScale(d))
            .curve(d3.curveMonotoneX);
    
        // Remove old path
        lineGroup.selectAll('path').remove();
    
        // Add the new path
        lineGroup.append('path')
            .datum(this.weightSums)
            .attr('fill', 'none')
            .attr('stroke', 'blue')
            .attr('stroke-width', 1.5)
            .attr('d', line);
    
        // Define the axes
        const xAxis = d3.axisBottom(xScale).ticks(5);
        const yAxis = d3.axisLeft(yScale).ticks(5);
    
        // Remove old axes
        lineGroup.selectAll('.x-axis').remove();
        lineGroup.selectAll('.y-axis').remove();
    
        // Append new axes
        lineGroup.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${plotSize})`)
            .call(xAxis);
    
        lineGroup.append('g')
            .attr('class', 'y-axis')
            .call(yAxis);
    }

    private addLegend(): void {
        const legend = this.svg.append('g')
            .attr('transform', 'translate(20,80)'); // Adjust positioning based on your layout

        // Buyer node legend
        legend.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 5)
            .style('fill', color("buyer"));
        legend.append('text')
            .attr('x', 10)
            .attr('y', 5)
            .text('Buyer')
            .style('font-size', '12px');

        // Seller node legend
        legend.append('circle')
            .attr('cx', 0)
            .attr('cy', 20)
            .attr('r', 5)
            .style('fill', color("seller"));
        legend.append('text')
            .attr('x', 10)
            .attr('y', 25)
            .text('Seller')
            .style('font-size', '12px');
    }

    private addColorBar(): void {
        const colorScale = d3.scaleSequential(d3.interpolateGreens).domain([0, 1]);

        const defs = this.svg.append('defs');
        const linearGradient = defs.append('linearGradient')
            .attr('id', 'gradient-color-bar');

        const numStops = 10; // Number of stops for the gradient
        linearGradient.selectAll('stop')
            .data(d3.range(numStops).map(i => ({
                offset: `${(i / (numStops - 1)) * 100}%`,
                color: colorScale(i / (numStops - 1))
            })))
            .enter().append('stop')
            .attr('offset', d => d.offset)
            .attr('stop-color', d => d.color);

        this.svg.append('rect')
            .attr('x', 10)
            .attr('y', 15)
            .attr('width', 100)
            .attr('height', 20)
            .style('fill', 'url(#gradient-color-bar)');

        // Add title for the colorbar
        this.svg.append('text')
            .attr('x', 10)
            .attr('y', 10)
            .style('font-size', '12px')
            .text('Relative Weight');

        // Add text labels for the color bar
        this.svg.append('text')
            .attr('x', 10)
            .attr('y', 45)
            .text('Low');

        this.svg.append('text')
            .attr('x', 110)
            .attr('y', 45)
            .style('text-anchor', 'end')
            .text('High');
        
    }

    private updateAdjacencyMatrix(): void {
        const cellSize = plotSize / this.nodes.length; // Size of each cell
    
        // Remove old matrix if present
        this.matrixGroup.selectAll('*').remove();
    
        // Create matrix cells
        this.matrixGroup.selectAll('rect')
            .data(this.nodes.flatMap((_, i) => this.nodes.map((_, j) => ({ i, j }))))
            .enter().append('rect')
            .attr('x', d => d.j * cellSize)
            .attr('y', d => d.i * cellSize)
            .attr('width', cellSize)
            .attr('height', cellSize)
            .style('fill', d => {
                const weight = this.getWeight(this.nodes[d.i], this.nodes[d.j]);
                return d3.interpolateGreens(weight / this.maxWeight);
            })
            .style('stroke', '#000'); // Optional: border color for visibility
    }
    
    // Helper function to get weight between two nodes
    private getWeight(nodeA: Node, nodeB: Node): number {
        const link = this.links.find(link =>
            (link.source === nodeA && link.target === nodeB) ||
            (link.source === nodeB && link.target === nodeA)
        );
        return link ? link.weight : 0;
    }
    
    
    
}
