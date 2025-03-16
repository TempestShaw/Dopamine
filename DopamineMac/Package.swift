// swift-tools-version:5.5
import PackageDescription

let package = Package(
    name: "DopamineMac",
    platforms: [.macOS(.v12)],
    products: [
        .executable(
            name: "DopamineMac",
            targets: ["DopamineMac"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-log.git", from: "1.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "DopamineMac",
            dependencies: [
                .product(name: "Logging", package: "swift-log"),
            ]
        ),
    ]
)