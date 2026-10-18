// Original procedural icon, reproducible without external artwork or services.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let destination = CommandLine.arguments[1]
let context = CGContext(data:nil,width:1024,height:1024,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue)!
context.setFillColor(CGColor(red:0.055,green:0.09,blue:0.11,alpha:1)); context.fill(CGRect(x:0,y:0,width:1024,height:1024))
let colors = [CGColor(red:0.14,green:0.25,blue:0.25,alpha:1),CGColor(red:0.055,green:0.09,blue:0.11,alpha:1)] as CFArray
let gradient = CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:colors,locations:[0,1])!
context.drawRadialGradient(gradient,startCenter:CGPoint(x:380,y:650),startRadius:0,endCenter:CGPoint(x:380,y:650),endRadius:850,options:.drawsAfterEndLocation)
context.setStrokeColor(CGColor(red:0.89,green:0.72,blue:0.43,alpha:1));context.setLineWidth(42);context.setLineCap(.round)
context.strokeEllipse(in:CGRect(x:185,y:326,width:470,height:470))
context.move(to:CGPoint(x:591,y:391));context.addLine(to:CGPoint(x:810,y:170));context.strokePath()
context.setStrokeColor(CGColor(red:0.57,green:0.85,blue:0.73,alpha:1));context.setLineWidth(28);context.setLineJoin(.round)
context.move(to:CGPoint(x:264,y:558));context.addLine(to:CGPoint(x:337,y:558));context.addLine(to:CGPoint(x:380,y:619));context.addLine(to:CGPoint(x:432,y:457));context.addLine(to:CGPoint(x:476,y:558));context.addLine(to:CGPoint(x:578,y:558));context.strokePath()
let image = context.makeImage()!
let output = CGImageDestinationCreateWithURL(URL(fileURLWithPath:destination) as CFURL,UTType.png.identifier as CFString,1,nil)!
CGImageDestinationAddImage(output,image,nil);precondition(CGImageDestinationFinalize(output))
