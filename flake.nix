{
  description = "Development shell for building guacamole-server with RDP/RDPECAM support";

  inputs = {
    nixpkgs.url = "nixpkgs";
  };

  outputs = { self, nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          dev = pkgs.lib.getDev;
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              autoconf
              automake
              gnumake
              libtool
              pkg-config
              gcc
              which
            ] ++ [
              (dev cairo)
              (dev cunit)
              (dev ffmpeg)
              (dev freerdp)
              (dev libjpeg)
              (dev libpng)
              (dev libssh2)
              (dev libtelnet)
              (dev libuuid)
              (dev libvncserver)
              (dev libwebp)
              (dev openssl)
              (dev pango)
              (dev pulseaudio)
            ];

            # Guacamole's RDP build currently pulls in deprecated FreeRDP symbols
            # under -Werror; keep warnings visible without failing the build.
            NIX_CFLAGS_COMPILE = "-Wno-error=deprecated-declarations";

            shellHook = ''
              echo "Nix dev shell ready."
              echo "Run: cd guacamole-server && ./configure && make -j\$(nproc)"
            '';
          };
        });
    };
}
