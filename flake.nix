{
  description = "Sitelink - Construction drawing analysis with YOLO-based callout detection";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

        pythonEnv = pkgs.python311.withPackages (ps: with ps; [
          pip
          virtualenv
        ]);

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pythonEnv
            pkgs.tesseract
            pkgs.poppler-utils
            pkgs.git
          ];

          shellHook = ''
            echo ""
            echo "Sitelink - Development Environment"
            echo "==================================="
            echo "Python: $(python --version)"
            echo ""
            echo "First time setup:"
            echo "  pip install torch torchvision ultralytics opencv-python pymupdf --index-url https://download.pytorch.org/whl/cu121"
            echo ""
          '';

          # For starship prompt detection
          NIX_SHELL_NAME = "sitelink";
        };
      }
    );
}
