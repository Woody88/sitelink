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
          config = {
            allowUnfree = true;
            cudaSupport = true;
          };
        };

        # Python packages for callout detection pipeline
        pythonEnv = pkgs.python311.withPackages (ps: with ps; [
          # Core ML/CV
          torch
          torchvision
          opencv4
          pillow
          numpy
          scipy

          # YOLO and object detection
          ultralytics

          # OCR
          paddleocr
          pytesseract

          # PDF processing
          pymupdf

          # Utilities
          requests
          python-dotenv
          tqdm
          pyyaml
          matplotlib

          # For labeling/annotation tools
          supervision

          # Development
          ipython
          jupyter
        ]);

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pythonEnv

            # CUDA toolkit for GPU training
            pkgs.cudaPackages.cudatoolkit
            pkgs.cudaPackages.cudnn

            # System dependencies
            pkgs.tesseract
            pkgs.poppler_utils  # for PDF utilities

            # Development tools
            pkgs.git
          ];

          shellHook = ''
            echo ""
            echo "🚀 Sitelink - Development Environment"
            echo "======================================"
            echo ""
            echo "Python: $(python --version)"
            echo "PyTorch: $(python -c 'import torch; print(torch.__version__)')"
            echo "CUDA available: $(python -c 'import torch; print(torch.cuda.is_available())')"
            if python -c 'import torch; exit(0 if torch.cuda.is_available() else 1)' 2>/dev/null; then
              echo "GPU: $(python -c 'import torch; print(torch.cuda.get_device_name(0))')"
            fi
            echo ""
            echo "Callout Processor:"
            echo "  cd packages/callout-processor-v4"
            echo "  python src/pipeline.py --help"
            echo ""
            echo "YOLO Training:"
            echo "  yolo detect train --help"
            echo ""

            export CUDA_HOME="${pkgs.cudaPackages.cudatoolkit}"
            export LD_LIBRARY_PATH="${pkgs.cudaPackages.cudatoolkit}/lib:${pkgs.cudaPackages.cudnn}/lib:$LD_LIBRARY_PATH"
          '';
        };
      }
    );
}
