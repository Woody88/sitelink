import type React from "react";
import { useState } from "react";
import PMTilesViewer from "./components/PMTilesViewer.tsx";

export default function App() {
	const [pmtilesUrl, setPmtilesUrl] = useState<string>("");
	const [isLoaded, setIsLoaded] = useState(false);

	const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const url = URL.createObjectURL(file);
			setPmtilesUrl(url);
			setIsLoaded(true);
		}
	};

	const handleUrlSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const url = formData.get("url") as string;
		if (url) {
			setPmtilesUrl(url);
			setIsLoaded(true);
		}
	};

	return (
		<div className="app">
			<header className="header">
				<h1>PMTiles + OpenSeadragon Spike Test</h1>
				<p>
					Proof-of-concept for deep zoom viewing of tiled images via PMTiles
				</p>
			</header>

			<main className="main">
				<div className="viewer-container">
					{isLoaded && pmtilesUrl ? (
						<PMTilesViewer pmtilesUrl={pmtilesUrl} />
					) : (
						<div style={{ padding: "2rem", color: "white" }}>
							<p>
								No PMTiles file loaded. Use the panel on the right to load a
								file.
							</p>
						</div>
					)}
				</div>

				<aside className="info-panel">
					<h2>PMTiles Loader</h2>

					<section>
						<h3>Load from File</h3>
						<input
							type="file"
							accept=".pmtiles"
							onChange={handleFileInput}
							style={{ width: "100%" }}
						/>
					</section>

					<section>
						<h3>Load from URL</h3>
						<form onSubmit={handleUrlSubmit}>
							<input
								type="text"
								name="url"
								placeholder="https://example.com/plan.pmtiles"
								style={{
									width: "100%",
									padding: "0.5rem",
									marginBottom: "0.5rem",
								}}
							/>
							<button
								type="submit"
								style={{ width: "100%", padding: "0.5rem" }}
							>
								Load URL
							</button>
						</form>
					</section>

					<section className="instructions">
						<h3>How to Generate PMTiles</h3>
						<p style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
							<strong>From PDF (one-pass):</strong>
						</p>
						<ol>
							<li>
								Install VIPS:
								<pre>
									<code>brew install vips</code>
								</pre>
							</li>
							<li>
								Convert PDF to tiles at 300 DPI:
								<pre>
									<code>{`vips dzsave 'plan.pdf[dpi=300]' tmp_tiles \\
  --layout google \\
  --suffix ".webp[Q=75]"`}</code>
								</pre>
							</li>
							<li>
								Pack to MBTiles:
								<pre>
									<code>{`mb-util tmp_tiles/ plan.mbtiles \\
  --scheme=zyx \\
  --image_format=webp`}</code>
								</pre>
							</li>
							<li>
								Convert to PMTiles:
								<pre>
									<code>pmtiles convert plan.mbtiles plan.pmtiles</code>
								</pre>
							</li>
						</ol>
						<p
							style={{
								fontSize: "0.75rem",
								color: "#888",
								marginTop: "0.5rem",
							}}
						>
							For images, replace step 2 with:{" "}
							<code style={{ fontSize: "0.75rem" }}>
								vips dzsave image.jpg tmp_tiles ...
							</code>
						</p>
					</section>

					<section>
						<h3>Status</h3>
						<div className={isLoaded ? "status ready" : "status loading"}>
							{isLoaded ? "PMTiles file loaded" : "Waiting for file..."}
						</div>
					</section>

					<section>
						<h3>Architecture Notes</h3>
						<p style={{ fontSize: "0.875rem", lineHeight: "1.5" }}>
							This spike uses the <code>imageLoader.addJob</code> override
							pattern from the OpenSeadragon docs. Tiles are loaded from PMTiles
							via custom protocol (<code>pmtiles://z/x/y</code>) and converted
							to blob URLs for display.
						</p>
					</section>
				</aside>
			</main>
		</div>
	);
}
