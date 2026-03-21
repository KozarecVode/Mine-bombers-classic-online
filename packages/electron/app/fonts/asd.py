import sys

data = open("FONTTI.FON","rb").read()

print("STARTFONT 2.1")
print("FONT retro8x8")
print("SIZE 8 75 75")
print("FONTBOUNDINGBOX 8 8 0 0")
print("CHARS 256")

for ch in range(256):
    print("STARTCHAR C{}".format(ch))
    print("ENCODING", ch)
    print("SWIDTH 500 0")
    print("DWIDTH 8 0")
    print("BBX 8 8 0 0")
    print("BITMAP")

    for row in range(8):
        byte = data[ch*8 + row]
        print("{:02X}".format(byte))

    print("ENDCHAR")

print("ENDFONT")