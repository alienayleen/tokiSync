
import json
import os

base_path = "/Users/pray4skylark/Documents/WorkSpace/tokiSync/graphify-out/"
chunks = [f".graphify_chunk_{i:02d}.json" for i in range(1, 7)]

final_graph = {
    "nodes": [],
    "edges": [],
    "hyperedges": []
}

for chunk_file in chunks:
    full_path = os.path.join(base_path, chunk_file)
    if os.path.exists(full_path):
        with open(full_path, 'r') as f:
            data = json.load(f)
            final_graph["nodes"].extend(data.get("nodes", []))
            final_graph["edges"].extend(data.get("edges", []))
            final_graph["hyperedges"].extend(data.get("hyperedges", []))

# Deduplicate nodes by ID
unique_nodes = {node["id"]: node for node in final_graph["nodes"]}.values()
final_graph["nodes"] = list(unique_nodes)

with open(os.path.join(base_path, "MERGED_GRAPH.json"), 'w') as f:
    json.dump(final_graph, f, indent=2)

print("Successfully merged all chunks into MERGED_GRAPH.json")
