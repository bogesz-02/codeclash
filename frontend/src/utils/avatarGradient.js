export function getGradientFromId(id, index) {
	// Predefined palette of gradients. Add or tweak entries here to change styles.
	const gradients = ["linear-gradient(135deg,#60a5fa,#7c3aed)", "linear-gradient(135deg,#34d399,#06b6d4)"];

	// If caller supplies an explicit index, use it (per-lobby assignment by position)
	if (typeof index === "number" && !Number.isNaN(index)) {
		return gradients[Math.abs(index) % gradients.length];
	}

	// Fallback: deterministic mapping from id hash into the palette
	if (!id) return gradients[0];
	let hash = 0;
	for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) | 0;
	return gradients[Math.abs(hash) % gradients.length];
}

export default getGradientFromId;
