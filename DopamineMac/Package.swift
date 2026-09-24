// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "DopamineMac",
    platforms: [.macOS(.v12)],
    products: [
        .executable(name: "DopamineMac", targets: ["DopamineMac"]),
    ],
    targets: [
        .executableTarget(
            name: "DopamineMac",
            linkerSettings: [.linkedLibrary("sqlite3")]
        ),
        .testTarget(
            name: "DopamineMacTests",
            dependencies: ["DopamineMac"]
        ),
    ]
)
