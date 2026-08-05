# Build script to compile the C++ Quant Math Engine into an executable
Write-Host "Compiling quant_math.exe (Microservice)..."
g++ -O3 -o quant_math.exe math_engine.cpp

if ($LASTEXITCODE -eq 0) {
    Write-Host "Success! quant_math.exe created." -ForegroundColor Green
} else {
    Write-Host "Compilation failed." -ForegroundColor Red
}
